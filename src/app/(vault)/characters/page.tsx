import Link from 'next/link';
import { prisma } from '@/lib/db/client';
import { Badge } from '@/components/ui/badge';
import { CharacterTable } from '@/components/character-table';

export default async function CharactersPage() {
  const characters = await prisma.character.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Character Vault</h2>
          <p className="text-sm text-slate-300">
            All Pathfinder Society characters you have built in TableHop.
          </p>
        </div>
        <Link
          href="/characters/new"
          className="rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/80"
        >
          New Character
        </Link>
      </header>
      <CharacterTable characters={characters} />
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Badge variant="outline">PFS Legal</Badge>
        <span>Entries validated against the Archives of Nethys Pathfinder Society rules.</span>
      </div>
    </section>
  );
}
