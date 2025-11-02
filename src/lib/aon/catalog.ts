import { promises as fs } from 'node:fs';
import path from 'node:path';
import { cache } from 'react';
import type { CatalogEntry, CatalogType } from './types';

const DATA_ROOT = path.join(process.cwd(), 'data', 'catalogs');

export const getCatalog = cache(async (type: CatalogType, pfsOnly = false) => {
  const file = path.join(DATA_ROOT, `${type}.json`);
  const raw = await fs.readFile(file, 'utf8');
  const entries = JSON.parse(raw) as CatalogEntry[];
  return pfsOnly ? entries.filter((entry) => entry.pfsLegal) : entries;
});

export const searchCatalog = async (
  type: CatalogType,
  query: string,
  options: { pfsOnly?: boolean } = {}
) => {
  const entries = await getCatalog(type, options.pfsOnly);
  const lower = query.toLowerCase();
  return entries.filter((entry) => entry.name.toLowerCase().includes(lower));
};
