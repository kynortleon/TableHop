import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { CharacterInput } from '@/lib/validators/character';
import { VALIDATION_ERROR_CODES } from '@/server/validate/pfs';
import { POST as validateCharacterRoute } from '@/app/api/characters/validate/route';
import { POST as createCharacterRoute } from '@/app/api/characters/route';

vi.mock('@/lib/db/client', () => {
  const state = {
    characters: new Map<string, any>(),
    versions: [] as any[]
  };

  const prismaMock: any = {
    character: {
      create: vi.fn(async ({ data }: { data: any }) => {
        const id = `char_${state.characters.size + 1}`;
        const record = { id, ...data };
        state.characters.set(id, record);
        return record;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
        const existing = state.characters.get(where.id);
        if (!existing) {
          throw new Error('Record not found');
        }
        const record = { ...existing, ...data, id: where.id };
        state.characters.set(where.id, record);
        return record;
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => state.characters.get(where.id) ?? null)
    },
    characterVersion: {
      create: vi.fn(async ({ data }: { data: any }) => {
        const id = `ver_${state.versions.length + 1}`;
        const record = { id, ...data };
        state.versions.push(record);
        return record;
      })
    },
    $transaction: vi.fn(async (callback: (tx: any) => Promise<any>) => callback(prismaMock))
  };

  return { prisma: prismaMock, __mockState: state };
});

const { __mockState } = await import('@/lib/db/client');

const legalCharacter: CharacterInput = {
  name: 'Merisiel',
  level: 1,
  ancestry: 'ancestry-human',
  heritage: 'heritage-human-skilled',
  background: 'background-acolyte',
  clazz: 'class-fighter',
  subclass: undefined,
  keyAbility: 'STR',
  abilities: {
    STR: 16,
    DEX: 12,
    CON: 12,
    INT: 10,
    WIS: 12,
    CHA: 10
  },
  skills: ['Athletics', 'Intimidation'],
  feats: [{ key: 'feat-battle-medicine', level: 1 }],
  spells: [],
  gear: [{ key: 'item-healing-potion', quantity: 1, totalCost: 4 }],
  companions: []
};

beforeEach(() => {
  __mockState.characters.clear();
  __mockState.versions.length = 0;
});

describe('Character API', () => {
  it('validates characters via the validate endpoint', async () => {
    const response = await validateCharacterRoute(
      new Request('http://localhost/api/characters/validate', {
        method: 'POST',
        body: JSON.stringify(legalCharacter)
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.valid).toBe(true);
    expect(body.errors).toHaveLength(0);
  });

  it('rejects illegal characters on create with detailed error codes', async () => {
    const invalidCharacter: CharacterInput = {
      ...legalCharacter,
      feats: [{ key: 'feat-trick-magic', level: 2 }]
    };
    const response = await createCharacterRoute(
      new Request('http://localhost/api/characters', {
        method: 'POST',
        body: JSON.stringify(invalidCharacter)
      })
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.valid).toBe(false);
    expect(body.errors.some((error: any) => error.code === VALIDATION_ERROR_CODES.FEAT_LEVEL_TOO_HIGH)).toBe(true);
  });

  it('saves valid characters and records a version entry', async () => {
    const response = await createCharacterRoute(
      new Request('http://localhost/api/characters', {
        method: 'POST',
        body: JSON.stringify(legalCharacter)
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.valid).toBe(true);
    expect(body.id).toBeDefined();
    expect(body.versionId).toBeDefined();
    expect(__mockState.versions.length).toBe(1);
  });
});
