import { promises as fs } from 'node:fs';
import path from 'node:path';
import { cache as reactCache } from 'react';
import { CatalogEntrySchema, CatalogTypeSchema, type CatalogEntry, type CatalogType } from './types';

const DATA_ROOT = process.env.CATALOG_DATA_ROOT
  ? path.resolve(process.env.CATALOG_DATA_ROOT)
  : path.join(process.cwd(), 'data', 'catalogs');

const cacheWrapper =
  typeof reactCache === 'function'
    ? reactCache
    : <Fn extends (...args: any[]) => Promise<any>>(fn: Fn): Fn => fn;

export const getCatalog = cacheWrapper(async (type: CatalogType, pfsOnly = false) => {
  const file = path.join(DATA_ROOT, `${type}.json`);
  const raw = await fs.readFile(file, 'utf8');
  const entries = CatalogEntrySchema.array().parse(JSON.parse(raw));
  return pfsOnly ? entries.filter((entry) => entry.pfsLegal) : entries;
});

export const searchCatalog = async (
  type: CatalogType,
  query: string,
  options: { pfsOnly?: boolean } = {}
) => {
  const catalogType = CatalogTypeSchema.parse(type);
  const entries = await getCatalog(catalogType, options.pfsOnly);
  const lower = query.toLowerCase();
  return entries.filter((entry) => entry.name.toLowerCase().includes(lower));
};
