import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/client';
import { startQueueWorker } from '@/server/socket';
import { emitQueueCounts } from '@/server/matchmaker';

function getUserId(request: NextRequest): string | null {
  return request.headers.get('x-user-id');
}

export async function GET(request: NextRequest) {
  const userId = getUserId(request);
  const { io } = await startQueueWorker();
  await emitQueueCounts(io);

  const [waitingPlayers, waitingDMs] = await Promise.all([
    prisma.queueEntry.count({ where: { dm: false, status: 'WAITING' } }),
    prisma.queueEntry.count({ where: { dm: true, status: 'WAITING' } })
  ]);

  const entry = userId
    ? await prisma.queueEntry.findUnique({ where: { userId } })
    : null;

  return NextResponse.json({
    waitingPlayers,
    waitingDMs,
    entry
  });
}
