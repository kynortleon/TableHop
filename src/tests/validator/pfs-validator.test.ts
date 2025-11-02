import { describe, expect, it } from 'vitest';
import type { CharacterInput } from '@/lib/validators/character';
import { validateCharacter, VALIDATION_ERROR_CODES } from '@/server/validate/pfs';

const baseCharacter: CharacterInput = {
  name: 'Valeros',
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
  gear: [],
  companions: []
};

function cloneCharacter(overrides: Partial<CharacterInput> = {}): CharacterInput {
  return {
    ...baseCharacter,
    abilities: { ...baseCharacter.abilities, ...(overrides.abilities ?? {}) },
    skills: overrides.skills ? [...overrides.skills] : [...baseCharacter.skills],
    feats: overrides.feats ? overrides.feats.map((feat) => ({ ...feat })) : baseCharacter.feats.map((feat) => ({ ...feat })),
    spells: overrides.spells
      ? overrides.spells.map((spell) => ({ ...spell }))
      : baseCharacter.spells.map((spell) => ({ ...spell })),
    gear: overrides.gear
      ? overrides.gear.map((item) => ({ ...item }))
      : baseCharacter.gear.map((item) => ({ ...item })),
    companions: overrides.companions
      ? overrides.companions.map((companion) => ({ ...companion }))
      : baseCharacter.companions.map((companion) => ({ ...companion })),
    ...overrides
  };
}

describe('validateCharacter', () => {
  it('accepts a baseline level 1 fighter', async () => {
    const result = await validateCharacter(cloneCharacter());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects feats that exceed the character level', async () => {
    const result = await validateCharacter(
      cloneCharacter({ feats: [{ key: 'feat-trick-magic', level: 2 }] })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === VALIDATION_ERROR_CODES.FEAT_LEVEL_TOO_HIGH)).toBe(true);
  });

  it('flags gear that exceeds the wealth-by-level cap', async () => {
    const result = await validateCharacter(
      cloneCharacter({ level: 3, gear: [{ key: 'item-wand-of-magic-missile', quantity: 1, totalCost: 200 }] })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === VALIDATION_ERROR_CODES.OVER_WBL)).toBe(true);
  });

  it('rejects spells higher than the class allows at that level', async () => {
    const result = await validateCharacter(
      cloneCharacter({
        level: 2,
        clazz: 'class-wizard',
        feats: [],
        skills: ['Arcana', 'Nature'],
        spells: [
          { key: 'spell-fireball', level: 3 }
        ]
      })
    );
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((error) => error.code === VALIDATION_ERROR_CODES.SPELL_LEVEL_TOO_HIGH)
    ).toBe(true);
  });

  it('requires companions to be granted by class or feats', async () => {
    const result = await validateCharacter(
      cloneCharacter({ companions: [{ type: 'animal', name: 'Wolf', source: 'Animal Friend' }] })
    );
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((error) => error.code === VALIDATION_ERROR_CODES.COMPANION_NOT_GRANTED)
    ).toBe(true);
  });

  it('enforces heritage matching the selected ancestry', async () => {
    const result = await validateCharacter(
      cloneCharacter({ heritage: 'heritage-elf-woodland' })
    );
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((error) => error.code === VALIDATION_ERROR_CODES.HERITAGE_MISMATCH)
    ).toBe(true);
  });
});
