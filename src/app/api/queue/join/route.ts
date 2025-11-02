import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { startQueueWorker } from '@/server/socket';
import { emitQueueCounts } from '@/server/matchmaker';

const joinSchema = z
  .object({
    dm: z.boolean().default(false),
    scenarioCode: z.string().optional(),
    characterId: z.string().optional()
  })
  .superRefine((value, ctx) => {
    if (value.dm) {
      if (!value.scenarioCode) {
        ctx.addIssue({
          path: ['scenarioCode'],
          code: z.ZodIssueCode.custom,
          message: 'Scenario code is required for dungeon masters.'
        });
      }
    } else if (!value.characterId) {
      ctx.addIssue({
        path: ['characterId'],
        code: z.ZodIssueCode.custom,
        message: 'Character is required for players.'
      });
    }
  });

function getUserId(request: NextRequest): string | null {
  return request.headers.get('x-user-id');
}

export async function POST(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Missing user identity.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = joinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = {
    ...parsed.data,
    scenarioCode: parsed.data.scenarioCode?.trim()
  };
  const { io } = await startQueueWorker();

  const entry = await prisma.queueEntry.upsert({
    where: { userId },
    update: {
      dm: payload.dm,
      scenarioCode: payload.dm ? payload.scenarioCode : null,
      characterId: payload.dm ? null : payload.characterId,
      status: 'WAITING'
    },
    create: {
      userId,
      dm: payload.dm,
      scenarioCode: payload.dm ? payload.scenarioCode : null,
      characterId: payload.dm ? null : payload.characterId,
      status: 'WAITING'
    }
  });

  io.emit('joinedQueue', entry);
  await emitQueueCounts(io);

  return NextResponse.json({ entry });
}
