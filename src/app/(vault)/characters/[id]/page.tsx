import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db/client';
import { Badge } from '@/components/ui/badge';
import { computeDerivedStats } from '@/server/validate/pfs';
import type { CharacterInput } from '@/lib/validators/character';

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

  const characterInput: CharacterInput = {
    name: character.name,
    level: character.level,
    ancestry: character.ancestry,
    heritage: (character as any).heritage ?? '',
    background: character.background,
    clazz: character.clazz,
    subclass: character.subclass ?? undefined,
    keyAbility: character.keyAbility as CharacterInput['keyAbility'],
    abilities: character.abilities as CharacterInput['abilities'],
    skills: (character.skills as string[]) ?? [],
    feats: (character.feats as CharacterInput['feats']) ?? [],
    spells: (character.spells as CharacterInput['spells']) ?? [],
    gear: (character.gear as CharacterInput['gear']) ?? [],
    companions: ((character as any).companions ?? []) as CharacterInput['companions']
  };

  const derived = computeDerivedStats(characterInput);

  const tabs = [
    { key: 'feats', label: 'Feats', data: characterInput.feats },
    { key: 'spells', label: 'Spells', data: characterInput.spells },
    { key: 'gear', label: 'Gear', data: characterInput.gear },
    { key: 'companions', label: 'Companions', data: characterInput.companions },
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
          Level {character.level} {character.ancestry}
          {characterInput.heritage ? ` (${characterInput.heritage})` : ''} {character.clazz}
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

      <section className="rounded border border-slate-800 bg-slate-950">
        <header className="border-b border-slate-800 bg-slate-900 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-300">
          Derived Stats
        </header>
        <dl className="grid gap-4 p-4 text-sm text-slate-100 sm:grid-cols-3">
          <Stat label="Armor Class" value={derived.armorClass} />
          <Stat label="Hit Points" value={derived.hitPoints} />
          <Stat label="Perception" value={derived.perception} />
          <Stat label="Fortitude" value={derived.fortitude} />
          <Stat label="Reflex" value={derived.reflex} />
          <Stat label="Will" value={derived.will} />
        </dl>
      </section>

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
                    <li key={idx} className="flex flex-col gap-1 rounded border border-slate-800 bg-slate-900 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex-1 text-sm font-semibold text-slate-100">
                        {entry.key ?? entry.name ?? entry.scenario ?? entry.type ?? 'Entry'}
                        {'name' in entry && entry.name && entry.key !== entry.name && (
                          <span className="ml-2 text-xs font-normal text-slate-300">{entry.name}</span>
                        )}
                        {'type' in entry && entry.type && !entry.key && (
                          <span className="ml-2 text-xs font-normal text-slate-300 capitalize">{entry.type}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        {'level' in entry && entry.level !== undefined && <span>Level {entry.level}</span>}
                        {'totalCost' in entry && entry.totalCost !== undefined && <span>{entry.totalCost} gp</span>}
                        {'source' in entry && entry.source && <span>{entry.source}</span>}
                        {'date' in entry && (
                          <span>{new Date(entry.date).toLocaleDateString()}</span>
                        )}
                      </div>
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-lg font-semibold text-slate-100">{value}</dd>
    </div>
  );
}
