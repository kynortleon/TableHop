import useSWR from 'swr';
import type { CatalogEntry, CatalogType } from '@/lib/aon/types';

const fetcher = async (url: string): Promise<CatalogEntry[]> => {
  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = (error as { error?: string }).error ?? 'Failed to load catalog';
    throw new Error(message);
  }
  return (await response.json()) as CatalogEntry[];
};

interface CatalogFilters {
  pfs?: boolean;
  q?: string;
  level?: number;
}

export function useCatalog(type: CatalogType, filters: CatalogFilters = {}) {
  const params = new URLSearchParams();
  const { pfs = true, q, level } = filters;

  if (pfs === false) {
    params.set('pfs', '0');
  } else {
    params.set('pfs', '1');
  }

  if (q && q.trim().length > 0) {
    params.set('q', q.trim());
  }

  if (typeof level === 'number' && Number.isFinite(level)) {
    params.set('level', String(level));
  }

  const query = params.toString();
  const key = `/api/catalog/${type}${query ? `?${query}` : ''}`;

  const { data, error, isLoading } = useSWR<CatalogEntry[]>(key, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true
  });

  return {
    data,
    loading: isLoading,
    error
  } as const;
}
