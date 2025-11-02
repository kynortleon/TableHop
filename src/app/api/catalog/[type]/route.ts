import { NextResponse } from 'next/server';
import { getCatalog } from '@/lib/aon/catalog';
import type { CatalogType } from '@/lib/aon/types';

export async function GET(
  _req: Request,
  { params }: { params: { type: CatalogType } }
) {
  const { searchParams } = new URL(_req.url);
  const pfsOnly = searchParams.get('pfs') === '1';
  try {
    const entries = await getCatalog(params.type, pfsOnly);
    return NextResponse.json(entries, { status: 200 });
  } catch (error) {
    console.error('Failed to read catalog', error);
    return NextResponse.json({ error: 'Catalog not found' }, { status: 404 });
  }
}
