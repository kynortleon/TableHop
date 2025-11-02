import { getCatalog } from '@/lib/aon/catalog';
import type { CatalogEntry } from '@/lib/aon/types';
import { CharacterWizard } from '@/components/character-wizard';

export default async function NewCharacterPage() {
  const [classes, ancestries, backgrounds, feats, spells, items] = await Promise.all([
    getCatalog('classes', true),
    getCatalog('ancestries', true),
    getCatalog('backgrounds', true),
    getCatalog('feats', true),
    getCatalog('spells', true),
    getCatalog('items', true)
  ]);

  const catalogs: Record<string, CatalogEntry[]> = {
    classes,
    ancestries,
    backgrounds,
    feats,
    spells,
    items
  };

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-3xl font-bold">New Character</h2>
        <p className="text-sm text-slate-300">
          Build a Pathfinder Society legal character with content sourced from the Archives of Nethys.
        </p>
      </header>
      <CharacterWizard catalogs={catalogs} />
    </section>
  );
}
