import type { CatalogEntry, CatalogType } from './types';
import { getCatalog } from './catalog';

interface LegalityResult {
  legal: boolean;
  reasons: string[];
}

const REQUIRED_TYPES: CatalogType[] = [
  'classes',
  'ancestries',
  'backgrounds',
  'heritages',
  'feats',
  'spells',
  'items'
];

const isEntryLegal = (entry: CatalogEntry | undefined) => !!entry?.pfsLegal;

export async function validateCharacterAgainstCatalogs(values: {
  ancestry: string;
  background: string;
  clazz: string;
  feats: Array<{ key: string }>;
  spells: Array<{ key: string }>;
  gear: Array<{ key: string }>;
}): Promise<LegalityResult> {
  const reasons: string[] = [];

  const catalogs = Object.fromEntries(
    await Promise.all(
      REQUIRED_TYPES.map(async (type) => [type, await getCatalog(type, true)])
    )
  ) as Record<CatalogType, CatalogEntry[]>;

  const findByKey = (type: CatalogType, key: string) =>
    catalogs[type].find((entry) => entry.key === key);

  if (!isEntryLegal(findByKey('ancestries', values.ancestry))) {
    reasons.push('Selected ancestry is not Pathfinder Society legal.');
  }

  if (!isEntryLegal(findByKey('backgrounds', values.background))) {
    reasons.push('Selected background is not Pathfinder Society legal.');
  }

  if (!isEntryLegal(findByKey('classes', values.clazz))) {
    reasons.push('Selected class is not Pathfinder Society legal.');
  }

  for (const feat of values.feats) {
    if (!isEntryLegal(findByKey('feats', feat.key))) {
      reasons.push(`Feat ${feat.key} is not Pathfinder Society legal.`);
    }
  }

  for (const spell of values.spells) {
    if (!isEntryLegal(findByKey('spells', spell.key))) {
      reasons.push(`Spell ${spell.key} is not Pathfinder Society legal.`);
    }
  }

  for (const item of values.gear) {
    if (!isEntryLegal(findByKey('items', item.key))) {
      reasons.push(`Item ${item.key} is not Pathfinder Society legal.`);
    }
  }

  return {
    legal: reasons.length === 0,
    reasons
  };
}
