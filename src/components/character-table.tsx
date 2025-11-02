import Link from 'next/link';
import type { Character } from '@prisma/client';
import { Badge } from './ui/badge';

interface Props {
  characters: Character[];
}

export function CharacterTable({ characters }: Props) {
  if (characters.length === 0) {
    return (
      <div className="rounded border border-dashed border-slate-700 p-10 text-center text-sm text-slate-400">
        No characters yet. Start by creating one.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded border border-slate-800">
      <table className="w-full min-w-full divide-y divide-slate-800">
        <thead className="bg-slate-900">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              Class
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              Level
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              PFS Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 bg-slate-950">
          {characters.map((character) => (
            <tr key={character.id} className="hover:bg-slate-900/50">
              <td className="px-4 py-3 text-sm font-semibold">
                <Link href={`/characters/${character.id}`} className="hover:text-primary">
                  {character.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-sm text-slate-300">{character.clazz}</td>
              <td className="px-4 py-3 text-sm text-slate-300">{character.level}</td>
              <td className="px-4 py-3 text-sm">
                <Badge variant={character.legality === 'PFS Legal' ? 'default' : 'outline'}>
                  {character.legality}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
