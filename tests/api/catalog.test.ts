import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/catalog/[type]/route';

const createRequest = (path: string) => new Request(`http://localhost${path}`);

describe('GET /api/catalog/[type]', () => {
  it('returns only PFS legal entries by default', async () => {
    const response = await GET(createRequest('/api/catalog/feats'), { params: { type: 'feats' } });
    expect(response.status).toBe(200);
    const data = (await response.json()) as Array<{ key: string; pfsLegal: boolean }>;
    expect(data).toHaveLength(2);
    expect(data.every((entry) => entry.pfsLegal)).toBe(true);
  });

  it('returns all entries when pfs=0', async () => {
    const response = await GET(createRequest('/api/catalog/feats?pfs=0'), { params: { type: 'feats' } });
    expect(response.status).toBe(200);
    const data = (await response.json()) as Array<{ key: string }>;
    expect(data.map((entry) => entry.key)).toContain('feat-risky-surgery');
  });

  it('filters by search query', async () => {
    const response = await GET(createRequest('/api/catalog/spells?q=fire'), { params: { type: 'spells' } });
    expect(response.status).toBe(200);
    const data = (await response.json()) as Array<{ name: string }>;
    expect(data).toHaveLength(1);
    expect(data[0]?.name).toBe('Fireball');
  });

  it('filters by level threshold', async () => {
    const response = await GET(createRequest('/api/catalog/feats?level=2'), { params: { type: 'feats' } });
    expect(response.status).toBe(200);
    const data = (await response.json()) as Array<{ key: string }>;
    expect(data.map((entry) => entry.key)).toEqual(['feat-trick-magic']);
  });

  it('rejects invalid catalog type', async () => {
    const response = await GET(createRequest('/api/catalog/invalid'), { params: { type: 'invalid' } });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('Invalid type');
  });
});
