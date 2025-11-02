import { createServer, type Server as HTTPServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server as SocketIOServer } from 'socket.io';
import { emitQueueCounts, startMatchmaker, stopMatchmaker, type MatchmakerOptions } from './matchmaker';

export interface QueueWorkerRuntime {
  io: SocketIOServer;
  httpServer: HTTPServer;
  port: number;
  close: () => Promise<void>;
}

let runtimePromise: Promise<QueueWorkerRuntime> | null = null;

export interface QueueWorkerOptions {
  port?: number;
  corsOrigin?: string;
  matchmaker?: Partial<MatchmakerOptions>;
}

async function createRuntime(options?: QueueWorkerOptions): Promise<QueueWorkerRuntime> {
  const httpServer = createServer();
  const port = options?.port ?? Number(process.env.QUEUE_SOCKET_PORT ?? 4010);
  const corsOrigin = options?.corsOrigin ?? process.env.QUEUE_SOCKET_CORS ?? '*';

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', (error) => {
      reject(error);
    });
    httpServer.listen(port, resolve);
  });

  const address = httpServer.address() as AddressInfo | null;
  const resolvedPort = address?.port ?? port;

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigin
    }
  });

  await startMatchmaker(io, options?.matchmaker);
  await emitQueueCounts(io);

  const close = async () => {
    stopMatchmaker();
    await new Promise<void>((resolve) => {
      io.removeAllListeners();
      io.close(() => resolve());
    });
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
    runtimePromise = null;
  };

  return { io, httpServer, port: resolvedPort, close };
}

export async function startQueueWorker(options?: QueueWorkerOptions): Promise<QueueWorkerRuntime> {
  if (!runtimePromise) {
    runtimePromise = createRuntime(options).catch((error) => {
      runtimePromise = null;
      throw error;
    });
  }
  return runtimePromise;
}

export async function getSocketServer(): Promise<SocketIOServer> {
  const { io } = await startQueueWorker();
  return io;
}

export async function stopQueueWorker(): Promise<void> {
  if (!runtimePromise) {
    return;
  }
  const runtime = await runtimePromise;
  await runtime.close();
}
