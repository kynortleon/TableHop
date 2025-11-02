import { NextResponse } from 'next/server';
import { getCatalog } from '@/lib/aon/catalog';
import { CatalogEntrySchema, CatalogTypeSchema, type CatalogType } from '@/lib/aon/types';

const VALID_TYPES = new Set<CatalogType>(CatalogTypeSchema.options);

export async function GET(req: Request, { params }: { params: { type: string } }) {
  const { searchParams } = new URL(req.url);
  if (!VALID_TYPES.has(params.type as CatalogType)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  const type = params.type as CatalogType;
  const pfsParam = searchParams.get('pfs');
  const enforcePfsOnly = pfsParam === '0' ? false : true;
  const query = searchParams.get('q')?.trim().toLowerCase() ?? '';
  const levelParam = searchParams.get('level');
  const levelFilter = levelParam ? Number(levelParam) : undefined;

  if (levelParam && Number.isNaN(levelFilter)) {
    return NextResponse.json({ error: 'Invalid level filter' }, { status: 400 });
  }

  const entries = await getCatalog(type, false);

  const filtered = entries.filter((entry) => {
    if (enforcePfsOnly && !entry.pfsLegal) {
      return false;
    }
    if (query && !entry.name.toLowerCase().includes(query)) {
      return false;
    }
    if (typeof levelFilter === 'number' && entry.level < levelFilter) {
      return false;
    }
    return true;
  });

  const validated = CatalogEntrySchema.array().parse(filtered);
  return NextResponse.json(validated, { status: 200 });
}
