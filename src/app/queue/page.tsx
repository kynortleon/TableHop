import { prisma } from '@/lib/db/client';
import QueueClient from './queue-client';

export default async function QueuePage() {
  const characters = await prisma.character.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      level: true,
      clazz: true
    }
  });

  return <QueueClient characters={characters} />;
}
