import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/client';
import { startQueueWorker } from '@/server/socket';
import { emitQueueCounts } from '@/server/matchmaker';

function getUserId(request: NextRequest): string | null {
  return request.headers.get('x-user-id');
}

export async function POST(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Missing user identity.' }, { status: 401 });
  }

  const { io } = await startQueueWorker();

  await prisma.queueEntry.updateMany({
    where: { userId, status: 'WAITING' },
    data: { status: 'LEFT' }
  });

  await emitQueueCounts(io);

  return NextResponse.json({ status: 'ok' });
}
