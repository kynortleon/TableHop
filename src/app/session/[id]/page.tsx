import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/client';
import SessionClient from './session-client';

interface SessionPageProps {
  params: { id: string };
}

export default async function SessionPage({ params }: SessionPageProps) {
  const session = await prisma.tableSession.findUnique({ where: { id: params.id } });
  if (!session) {
    notFound();
  }

  return <SessionClient session={session} />;
}
