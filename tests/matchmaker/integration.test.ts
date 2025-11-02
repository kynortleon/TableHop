import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { io as ioClient, type Socket } from 'socket.io-client';
import { randomUUID } from 'node:crypto';
import type { QueueWorkerRuntime } from '@/server/socket';

vi.mock('@/lib/db/client', () => {
  const queueEntries = new Map<string, any>();
  const tableSessions = new Map<string, any>();
  const characters = new Map<string, any>();

  const prismaMock: any = {
    queueEntry: {
      async create({ data }: { data: any }) {
        const id = data.id ?? randomUUID();
        const record = {
          id,
          dm: false,
          status: 'WAITING',
          createdAt: new Date(),
          ...data
        };
        queueEntries.set(id, record);
        return { ...record };
      },
      async findMany({ where, orderBy }: { where: any; orderBy?: any }) {
        let items = Array.from(queueEntries.values()).filter((entry) => {
          if (!where) {
            return true;
          }
          return Object.entries(where).every(([key, value]) => {
            if (typeof value === 'object' && value !== null && 'in' in value) {
              return value.in.includes(entry[key]);
            }
            return entry[key] === value;
          });
        });
        if (orderBy?.createdAt === 'asc') {
          items = items.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        }
        return items.map((item) => ({ ...item }));
      },
      async count({ where }: { where: any }) {
        return (await prismaMock.queueEntry.findMany({ where })).length;
      },
      async update({ where, data }: { where: { id: string }; data: any }) {
        const existing = queueEntries.get(where.id);
        if (!existing) throw new Error('Queue entry not found');
        const record = { ...existing, ...data };
        queueEntries.set(where.id, record);
        return { ...record };
      },
      async updateMany({ where, data }: { where: { id: { in: string[] } }; data: any }) {
        let count = 0;
        for (const id of where.id.in) {
          const existing = queueEntries.get(id);
          if (existing) {
            queueEntries.set(id, { ...existing, ...data });
            count += 1;
          }
        }
        return { count };
      },
      async deleteMany() {
        const count = queueEntries.size;
        queueEntries.clear();
        return { count };
      }
    },
    tableSession: {
      async create({ data }: { data: any }) {
        const id = data.id ?? randomUUID();
        const record = {
          id,
          createdAt: new Date(),
          status: 'LOADING',
          durationMinutes: 0,
          ...data
        };
        tableSessions.set(id, record);
        return { ...record };
      },
      async update({ where, data }: { where: { id: string }; data: any }) {
        const existing = tableSessions.get(where.id);
        if (!existing) throw new Error('Session not found');
        const record = { ...existing, ...data };
        tableSessions.set(where.id, record);
        return { ...record };
      },
      async findUnique({ where }: { where: { id: string } }) {
        const record = tableSessions.get(where.id);
        return record ? { ...record } : null;
      },
      async deleteMany() {
        const count = tableSessions.size;
        tableSessions.clear();
        return { count };
      }
    },
    character: {
      async create({ data }: { data: any }) {
        const id = data.id ?? randomUUID();
        const record = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
        characters.set(id, record);
        return { ...record };
      },
      async findUnique({ where }: { where: { id: string } }) {
        const record = characters.get(where.id);
        return record ? { ...record } : null;
      },
      async deleteMany() {
        const count = characters.size;
        characters.clear();
        return { count };
      }
    },
    $transaction: async (callback: (tx: any) => Promise<any>) => callback(prismaMock)
  };

  return { prisma: prismaMock, __queueState: { queueEntries, tableSessions, characters } };
});

const { prisma } = await import('@/lib/db/client');
const { startQueueWorker, stopQueueWorker } = await import('@/server/socket');

const abilities = { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 } as const;

async function createCharacter(name: string) {
  return prisma.character.create({
    data: {
      name,
      level: 1,
      ancestry: 'human',
      background: 'scholar',
      clazz: 'class-fighter',
      keyAbility: 'STR',
      abilities,
      skills: [],
      feats: [],
      spells: [],
      gear: [],
      companions: []
    }
  });
}

describe('matchmaker integration', () => {
  let runtime: QueueWorkerRuntime;
  let socket: Socket;

  beforeAll(async () => {
    runtime = await startQueueWorker({
      port: 0,
      matchmaker: {
        intervalMs: 20,
        adDurationMs: 500,
        sessionDurationMs: 1000
      }
    });
    socket = ioClient(`http://localhost:${runtime.port}`);
    await new Promise<void>((resolve, reject) => {
      if (socket.connected) {
        resolve();
        return;
      }
      socket.once('connect', () => resolve());
      socket.once('connect_error', (error) => reject(error));
    });
  }, 10_000);

  afterAll(async () => {
    socket?.disconnect();
    await stopQueueWorker();
  });

  beforeEach(async () => {
    await prisma.tableSession.deleteMany();
    await prisma.queueEntry.deleteMany();
    await prisma.character.deleteMany();
  });

  it('creates a table, starts ads, and closes the session automatically', async () => {
    const characters = await Promise.all([
      createCharacter('Alyx'),
      createCharacter('Bran'),
      createCharacter('Cali'),
      createCharacter('Daro')
    ]);

    const tableCreatedPromise = new Promise<any>((resolve) => {
      socket.once('tableCreated', (payload) => resolve(payload));
    });
    const adStartPromise = new Promise<{ sessionId: string; seconds: number }>((resolve) => {
      socket.once('adStart', (payload) => resolve(payload));
    });
    const tableClosedPromise = new Promise<{ sessionId: string }>((resolve) => {
      socket.once('tableClosed', (payload) => resolve(payload));
    });

    await prisma.queueEntry.create({
      data: {
        userId: 'dm-1',
        dm: true,
        scenarioCode: 'PFS-10-01'
      }
    });

    await Promise.all(
      characters.map((character, index) =>
        prisma.queueEntry.create({
          data: {
            userId: `player-${index + 1}`,
            dm: false,
            characterId: character.id
          }
        })
      )
    );

    const tableCreated = await tableCreatedPromise;
    expect(tableCreated.dmId).toBe('dm-1');
    expect(tableCreated.playerIds).toHaveLength(4);

    const adStart = await adStartPromise;
    expect(adStart.sessionId).toBe(tableCreated.id);
    expect(adStart.seconds).toBeGreaterThanOrEqual(0);

    const tableClosed = await tableClosedPromise;
    expect(tableClosed.sessionId).toBe(tableCreated.id);

    const sessionRecord = await prisma.tableSession.findUnique({ where: { id: tableCreated.id } });
    expect(sessionRecord?.status).toBe('CLOSED');
    expect(sessionRecord?.durationMinutes).toBeGreaterThanOrEqual(2);
  }, 20_000);
});
