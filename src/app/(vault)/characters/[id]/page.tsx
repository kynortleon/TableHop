import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db/client';
import { Badge } from '@/components/ui/badge';

interface Props {
  params: { id: string };
}

export default async function CharacterDetailPage({ params }: Props) {
  const character = await prisma.character.findUnique({
    where: { id: params.id },
    include: { logEntries: { orderBy: { date: 'desc' } } }
  });

  if (!character) {
    notFound();
  }

  const tabs = [
    { key: 'feats', label: 'Feats', data: character.feats },
    { key: 'spells', label: 'Spells', data: character.spells },
    { key: 'gear', label: 'Gear', data: character.gear },
    { key: 'companions', label: 'Companions', data: [] },
    { key: 'log', label: 'PFS Log', data: character.logEntries }
  ];

  return (
    <section className="space-y-8">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-3xl font-bold">{character.name}</h2>
          <Badge variant={character.legality === 'PFS Legal' ? 'default' : 'outline'}>
            {character.legality}
          </Badge>
        </div>
        <div className="text-sm text-slate-300">
          Level {character.level} {character.ancestry} {character.clazz}
        </div>
        {character.legalityLog && (
          <div className="rounded border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
            <strong className="text-slate-100">Legality Notes:</strong>
            <pre className="whitespace-pre-wrap text-xs text-slate-300">{character.legalityLog}</pre>
          </div>
        )}
        <Link href="/characters" className="text-xs text-primary">
          Back to vault
        </Link>
      </header>

      <div className="space-y-6">
        {tabs.map((tab) => (
          <section key={tab.key} className="rounded border border-slate-800 bg-slate-950">
            <header className="border-b border-slate-800 bg-slate-900 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-300">
              {tab.label}
            </header>
            <div className="p-4 text-sm text-slate-200">
              {Array.isArray(tab.data) && tab.data.length > 0 ? (
                <ul className="space-y-2">
                  {tab.data.map((entry: any, idx: number) => (
                    <li key={idx} className="flex items-center justify-between gap-4">
                      <span>{entry.key ?? entry.scenario ?? 'Entry'}</span>
                      {'level' in entry && entry.level !== undefined && (
                        <span className="text-xs text-slate-400">Level {entry.level}</span>
                      )}
                      {'totalCost' in entry && entry.totalCost !== undefined && (
                        <span className="text-xs text-slate-400">{entry.totalCost} gp</span>
                      )}
                      {'date' in entry && (
                        <span className="text-xs text-slate-400">
                          {new Date(entry.date).toLocaleDateString()}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">No entries yet.</p>
              )}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
