import { z } from 'zod';
import { getCatalog } from '@/lib/aon/catalog';
import type { CatalogEntry } from '@/lib/aon/types';
import type { CharacterInput } from '@/lib/validators/character';
import type { ValidationIssue, ValidationSummary } from '@/types/pfs';

export const VALIDATION_ERROR_CODES = {
  NOT_PFS_LEGAL: 'NOT_PFS_LEGAL',
  CATALOG_MISSING: 'CATALOG_MISSING',
  LEVEL_OUT_OF_RANGE: 'LEVEL_OUT_OF_RANGE',
  FEAT_LEVEL_TOO_HIGH: 'FEAT_LEVEL_TOO_HIGH',
  FEAT_PREREQUISITE_FAILED: 'FEAT_PREREQUISITE_FAILED',
  SKILL_TRAINING_EXCEEDED: 'SKILL_TRAINING_EXCEEDED',
  DUPLICATE_SKILL: 'DUPLICATE_SKILL',
  SPELL_LEVEL_TOO_HIGH: 'SPELL_LEVEL_TOO_HIGH',
  SPELL_TRADITION_INVALID: 'SPELL_TRADITION_INVALID',
  SPELL_SLOTS_EXCEEDED: 'SPELL_SLOTS_EXCEEDED',
  CLASS_CANNOT_CAST: 'CLASS_CANNOT_CAST',
  OVER_WBL: 'OVER_WBL',
  ITEM_NOT_FOUND: 'ITEM_NOT_FOUND',
  COMPANION_NOT_GRANTED: 'COMPANION_NOT_GRANTED',
  HERITAGE_MISMATCH: 'HERITAGE_MISMATCH',
  HERITAGE_NOT_FOUND: 'HERITAGE_NOT_FOUND'
} as const;

export type ValidationErrorCode = (typeof VALIDATION_ERROR_CODES)[keyof typeof VALIDATION_ERROR_CODES];

export interface DerivedStats {
  armorClass: number;
  hitPoints: number;
  perception: number;
  fortitude: number;
  reflex: number;
  will: number;
}

const WBL_TABLE: Record<number, number> = {
  1: 15,
  2: 30,
  3: 50,
  4: 75,
  5: 120,
  6: 175,
  7: 260,
  8: 360,
  9: 480,
  10: 650
};

const CLASS_SKILL_BASE: Record<string, number> = {
  'class-rogue': 6,
  'class-ranger': 4,
  'class-bard': 4,
  'class-druid': 4,
  'class-fighter': 3,
  'class-cleric': 3,
  'class-champion': 3,
  'class-wizard': 2,
  default: 3
};

const CLASS_BASE_HP: Record<string, number> = {
  'class-barbarian': 12,
  'class-champion': 10,
  'class-fighter': 10,
  'class-ranger': 10,
  'class-rogue': 8,
  'class-bard': 8,
  'class-druid': 8,
  'class-cleric': 8,
  'class-monk': 10,
  'class-witch': 6,
  'class-wizard': 6,
  'class-sorcerer': 6,
  default: 8
};

const CLASS_TRADITIONS: Record<string, string[]> = {
  'class-wizard': ['arcane'],
  'class-sorcerer': ['arcane', 'divine', 'occult', 'primal'],
  'class-cleric': ['divine'],
  'class-druid': ['primal'],
  'class-witch': ['arcane', 'divine', 'occult', 'primal'],
  'class-bard': ['occult'],
  'class-oracle': ['divine'],
  'class-psychic': ['occult'],
  'class-magus': ['arcane'],
  'class-summoner': ['arcane', 'occult'],
  'class-champion': ['divine'],
  'class-ranger': ['primal']
};

const PROFICIENCY_BONUS: Record<'trained' | 'expert' | 'master' | 'legendary', number> = {
  trained: 2,
  expert: 4,
  master: 6,
  legendary: 8
};

const CLASS_PROFICIENCIES: Record<string, {
  ac: 'trained' | 'expert' | 'master' | 'legendary';
  fortitude: 'trained' | 'expert' | 'master' | 'legendary';
  reflex: 'trained' | 'expert' | 'master' | 'legendary';
  will: 'trained' | 'expert' | 'master' | 'legendary';
  perception: 'trained' | 'expert' | 'master' | 'legendary';
}> = {
  'class-fighter': { ac: 'expert', fortitude: 'expert', reflex: 'expert', will: 'trained', perception: 'expert' },
  'class-rogue': { ac: 'expert', fortitude: 'trained', reflex: 'expert', will: 'expert', perception: 'expert' },
  'class-ranger': { ac: 'expert', fortitude: 'expert', reflex: 'expert', will: 'trained', perception: 'expert' },
  'class-barbarian': { ac: 'trained', fortitude: 'expert', reflex: 'expert', will: 'trained', perception: 'trained' },
  'class-champion': { ac: 'expert', fortitude: 'master', reflex: 'trained', will: 'expert', perception: 'trained' },
  'class-cleric': { ac: 'trained', fortitude: 'expert', reflex: 'trained', will: 'expert', perception: 'trained' },
  'class-druid': { ac: 'trained', fortitude: 'expert', reflex: 'trained', will: 'expert', perception: 'expert' },
  'class-wizard': { ac: 'trained', fortitude: 'trained', reflex: 'trained', will: 'expert', perception: 'trained' },
  'class-bard': { ac: 'trained', fortitude: 'trained', reflex: 'expert', will: 'expert', perception: 'expert' },
  'class-sorcerer': { ac: 'trained', fortitude: 'trained', reflex: 'trained', will: 'expert', perception: 'trained' },
  default: { ac: 'trained', fortitude: 'trained', reflex: 'trained', will: 'trained', perception: 'trained' }
};

const FULL_CASTER_SLOTS: Record<number, Record<number, number>> = {
  1: { 1: 2 },
  2: { 1: 3 },
  3: { 1: 3, 2: 2 },
  4: { 1: 4, 2: 3 },
  5: { 1: 4, 2: 3, 3: 2 },
  6: { 1: 4, 2: 3, 3: 3 },
  7: { 1: 4, 2: 4, 3: 3, 4: 2 },
  8: { 1: 4, 2: 4, 3: 3, 4: 3 },
  9: { 1: 4, 2: 4, 3: 4, 4: 3, 5: 2 },
  10: { 1: 4, 2: 4, 3: 4, 4: 3, 5: 3 }
};

const SPELL_SLOT_TABLE: Record<string, Record<number, Record<number, number>>> = new Proxy({}, {
  get(target, key: string) {
    if (key in target) {
      return target[key as keyof typeof target];
    }
    if (key.startsWith('class-') && CLASS_TRADITIONS[key]) {
      return (target[key as keyof typeof target] = FULL_CASTER_SLOTS);
    }
    return (target[key as keyof typeof target] = {});
  }
});

const CompanionTypeSchema = z.enum(['animal', 'familiar', 'eidolon']);

const abilityModifier = (score: number | undefined) => Math.floor(((score ?? 10) - 10) / 2);

const extractTraditions = (entry: CatalogEntry) =>
  entry.tags
    .map((tag) => tag.toLowerCase())
    .filter((tag) => tag.startsWith('tradition:'))
    .map((tag) => tag.split(':')[1]);

const parseGrantTags = (entry: CatalogEntry) =>
  entry.tags
    .map((tag) => tag.toLowerCase())
    .filter((tag) => tag.startsWith('grants:'))
    .map((tag) => tag.split(':')[1] as z.infer<typeof CompanionTypeSchema>);

const priceFromTags = (entry: CatalogEntry, fallback: number, quantity: number) => {
  const raw = entry.tags.find((tag) => tag.toLowerCase().startsWith('price:'));
  if (!raw) {
    return fallback;
  }
  const [, value] = raw.split(':');
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return parsed * quantity;
};

export function sumWealth(
  gear: CharacterInput['gear'],
  itemsCatalog: Map<string, CatalogEntry>
): { total: number; breakdown: Array<{ key: string; total: number }>; issues: ValidationIssue[] } {
  let total = 0;
  const breakdown: Array<{ key: string; total: number }> = [];
  const issues: ValidationIssue[] = [];

  for (const item of gear) {
    const entry = itemsCatalog.get(item.key);
    if (!entry) {
      issues.push({
        field: 'gear',
        code: VALIDATION_ERROR_CODES.ITEM_NOT_FOUND,
        message: `Unknown gear item ${item.key}.`,
        url: undefined
      });
      continue;
    }
    if (!entry.pfsLegal) {
      issues.push({
        field: 'gear',
        code: VALIDATION_ERROR_CODES.NOT_PFS_LEGAL,
        message: `${entry.name} is not PFS legal.`,
        url: entry.url
      });
      continue;
    }
    const itemTotal = priceFromTags(entry, item.totalCost, item.quantity);
    breakdown.push({ key: item.key, total: itemTotal });
    total += itemTotal;
  }

  return { total, breakdown, issues };
}

export interface VersionSummary {
  addedFeats: string[];
  removedFeats: string[];
  goldDelta: number;
  spellCountByLevel: Record<number, number>;
}

const getSpellSlotsForClassLevel = (classKey: string, level: number) => {
  const table = SPELL_SLOT_TABLE[classKey] ?? {};
  return table[level] ?? {};
};

const highestSpellLevel = (classKey: string, level: number) => {
  const slots = getSpellSlotsForClassLevel(classKey, level);
  const slotLevels = Object.keys(slots).map((key) => Number(key));
  return slotLevels.length > 0 ? Math.max(...slotLevels) : 0;
};

export function checkPrereqs(
  feat: CatalogEntry,
  context: {
    character: CharacterInput;
    feats: CatalogEntry[];
    classEntry?: CatalogEntry;
  }
): ValidationIssue | null {
  const tags = feat.tags.map((tag) => tag.toLowerCase());
  const dedicationPresent = context.feats.some((entry) =>
    entry.tags.some((tag) => tag.toLowerCase() === 'dedication')
  );

  if (tags.includes('archetype') && !tags.includes('dedication') && !dedicationPresent) {
    return {
      field: 'feats',
      code: VALIDATION_ERROR_CODES.FEAT_PREREQUISITE_FAILED,
      message: `${feat.name} requires a dedication feat before other archetype feats.`,
      url: feat.url
    };
  }

  const classTags = tags.filter((tag) => tag.startsWith('class:'));
  if (classTags.length > 0) {
    const allowed = classTags.some((tag) => {
      const [, key] = tag.split(':');
      return key === context.character.clazz || `class-${key}` === context.character.clazz;
    });
    if (!allowed) {
      return {
        field: 'feats',
        code: VALIDATION_ERROR_CODES.FEAT_PREREQUISITE_FAILED,
        message: `${feat.name} is limited to ${classTags[0]?.split(':')[1] ?? 'a specific class'}.`,
        url: feat.url
      };
    }
  }

  const abilityTag = tags.find((tag) => tag.startsWith('ability:'));
  if (abilityTag) {
    const [, requirement] = abilityTag.split(':');
    const [ability, value] = requirement.split('=');
    const requiredScore = Number(value ?? '0');
    const actual = context.character.abilities?.[ability.toUpperCase() as keyof typeof context.character.abilities];
    if (Number.isFinite(requiredScore) && (actual ?? 0) < requiredScore) {
      return {
        field: 'feats',
        code: VALIDATION_ERROR_CODES.FEAT_PREREQUISITE_FAILED,
        message: `${feat.name} requires ${ability.toUpperCase()} ${requiredScore}.`,
        url: feat.url
      };
    }
  }

  return null;
}

export function computeDerivedStats(character: CharacterInput): DerivedStats {
  const level = Math.max(1, Math.min(20, character.level ?? 1));
  const classKey = character.clazz;
  const baseHp = CLASS_BASE_HP[classKey] ?? CLASS_BASE_HP.default;
  const prof = CLASS_PROFICIENCIES[classKey] ?? CLASS_PROFICIENCIES.default;

  const dexMod = abilityModifier(character.abilities?.DEX);
  const conMod = abilityModifier(character.abilities?.CON);
  const wisMod = abilityModifier(character.abilities?.WIS);

  const ac = 10 + dexMod + getProficiencyBonus(prof.ac, level);
  const fortitude = conMod + getProficiencyBonus(prof.fortitude, level);
  const reflex = dexMod + getProficiencyBonus(prof.reflex, level);
  const will = wisMod + getProficiencyBonus(prof.will, level);
  const perception = wisMod + getProficiencyBonus(prof.perception, level);
  const hp = Math.max(level * 1, (baseHp + Math.max(conMod, 0)) * level);

  return {
    armorClass: ac,
    hitPoints: hp,
    perception,
    fortitude,
    reflex,
    will
  };
}

function getProficiencyBonus(rank: 'trained' | 'expert' | 'master' | 'legendary', level: number) {
  const base = PROFICIENCY_BONUS[rank] ?? PROFICIENCY_BONUS.trained;
  return base + level;
}

interface CatalogContext {
  ancestries: Map<string, CatalogEntry>;
  backgrounds: Map<string, CatalogEntry>;
  heritages: Map<string, CatalogEntry>;
  classes: Map<string, CatalogEntry>;
  feats: Map<string, CatalogEntry>;
  spells: Map<string, CatalogEntry>;
  items: Map<string, CatalogEntry>;
}

const toCatalogMap = (entries: CatalogEntry[]) =>
  new Map(entries.map((entry) => [entry.key, entry] as const));

const levelGuard = (level: number) => level >= 1 && level <= 10;

const validateUniqueness = (values: string[]): boolean => new Set(values).size === values.length;

export async function validateCharacter(character: CharacterInput): Promise<ValidationSummary> {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const [ancestries, backgrounds, heritages, classes, feats, spells, items] = await Promise.all([
    getCatalog('ancestries'),
    getCatalog('backgrounds'),
    getCatalog('heritages'),
    getCatalog('classes'),
    getCatalog('feats'),
    getCatalog('spells'),
    getCatalog('items')
  ]);

  const catalogs: CatalogContext = {
    ancestries: toCatalogMap(ancestries),
    backgrounds: toCatalogMap(backgrounds),
    heritages: toCatalogMap(heritages),
    classes: toCatalogMap(classes),
    feats: toCatalogMap(feats),
    spells: toCatalogMap(spells),
    items: toCatalogMap(items)
  };

  if (!levelGuard(character.level)) {
    errors.push({
      field: 'level',
      code: VALIDATION_ERROR_CODES.LEVEL_OUT_OF_RANGE,
      message: 'Characters must be between level 1 and 10 for Pathfinder Society play.'
    });
  }

  const ancestry = catalogs.ancestries.get(character.ancestry);
  if (!ancestry) {
    errors.push({
      field: 'ancestry',
      code: VALIDATION_ERROR_CODES.CATALOG_MISSING,
      message: 'Selected ancestry is not recognised.'
    });
  } else if (!ancestry.pfsLegal) {
    errors.push({
      field: 'ancestry',
      code: VALIDATION_ERROR_CODES.NOT_PFS_LEGAL,
      message: `${ancestry.name} is not Pathfinder Society legal.`,
      url: ancestry.url
    });
  }

  const background = catalogs.backgrounds.get(character.background);
  if (!background) {
    errors.push({
      field: 'background',
      code: VALIDATION_ERROR_CODES.CATALOG_MISSING,
      message: 'Selected background is not recognised.'
    });
  } else if (!background.pfsLegal) {
    errors.push({
      field: 'background',
      code: VALIDATION_ERROR_CODES.NOT_PFS_LEGAL,
      message: `${background.name} is not Pathfinder Society legal.`,
      url: background.url
    });
  }

  const classEntry = catalogs.classes.get(character.clazz);
  if (!classEntry) {
    errors.push({
      field: 'clazz',
      code: VALIDATION_ERROR_CODES.CATALOG_MISSING,
      message: 'Selected class is not recognised.'
    });
  } else if (!classEntry.pfsLegal) {
    errors.push({
      field: 'clazz',
      code: VALIDATION_ERROR_CODES.NOT_PFS_LEGAL,
      message: `${classEntry.name} is not Pathfinder Society legal.`,
      url: classEntry.url
    });
  }

  if (character.heritage) {
    const heritageEntry = catalogs.heritages.get(character.heritage);
    if (!heritageEntry) {
      errors.push({
        field: 'heritage',
        code: VALIDATION_ERROR_CODES.HERITAGE_NOT_FOUND,
        message: 'Selected heritage is not recognised.'
      });
    } else if (!heritageEntry.pfsLegal) {
      errors.push({
        field: 'heritage',
        code: VALIDATION_ERROR_CODES.NOT_PFS_LEGAL,
        message: `${heritageEntry.name} is not Pathfinder Society legal.`,
        url: heritageEntry.url
      });
    } else if (character.ancestry) {
      const ancestryTag = heritageEntry.tags.find((tag) => tag.toLowerCase().startsWith('ancestry:'));
      const ancestryKey = ancestryTag?.split(':')[1];
      if (ancestryKey && ancestryKey !== character.ancestry) {
        errors.push({
          field: 'heritage',
          code: VALIDATION_ERROR_CODES.HERITAGE_MISMATCH,
          message: `${heritageEntry.name} belongs to ${ancestryKey.replace('ancestry-', '')} ancestries.`,
          url: heritageEntry.url
        });
      }
    }
  }

  if (character.skills.length > 0) {
    if (!validateUniqueness(character.skills)) {
      errors.push({
        field: 'skills',
        code: VALIDATION_ERROR_CODES.DUPLICATE_SKILL,
        message: 'Duplicate trained skills selected.'
      });
    }

    const baseTraining = classEntry ? CLASS_SKILL_BASE[classEntry.key] ?? CLASS_SKILL_BASE.default : CLASS_SKILL_BASE.default;
    const skillIncreases = Math.floor((Math.max(character.level, 1) + 1) / 2);
    const available = Math.max(0, baseTraining + abilityModifier(character.abilities?.INT)) + skillIncreases;
    if (character.skills.length > available) {
      errors.push({
        field: 'skills',
        code: VALIDATION_ERROR_CODES.SKILL_TRAINING_EXCEEDED,
        message: `Selected ${character.skills.length} trained skills but only ${available} are available.`,
        url: classEntry?.url
      });
    }
  }

  const selectedFeats: CatalogEntry[] = [];
  for (const featSelection of character.feats) {
    const entry = catalogs.feats.get(featSelection.key);
    if (!entry) {
      errors.push({
        field: 'feats',
        code: VALIDATION_ERROR_CODES.CATALOG_MISSING,
        message: `Feat ${featSelection.key} is not recognised.`,
        url: undefined
      });
      continue;
    }
    if (!entry.pfsLegal) {
      errors.push({
        field: 'feats',
        code: VALIDATION_ERROR_CODES.NOT_PFS_LEGAL,
        message: `${entry.name} is not Pathfinder Society legal.`,
        url: entry.url
      });
      continue;
    }
    if (featSelection.level > character.level) {
      errors.push({
        field: 'feats',
        code: VALIDATION_ERROR_CODES.FEAT_LEVEL_TOO_HIGH,
        message: `${entry.name} is higher level (${featSelection.level}) than the character.`,
        url: entry.url
      });
    }

    const prereqIssue = checkPrereqs(entry, { character, feats: [...selectedFeats, entry], classEntry });
    if (prereqIssue) {
      errors.push(prereqIssue);
    }

    selectedFeats.push(entry);
  }

  const selectedFeatsSet = new Set(selectedFeats.map((feat) => feat.key));

  const spellSlots = classEntry ? getSpellSlotsForClassLevel(classEntry.key, character.level) : {};
  const maxSpellLevel = classEntry ? highestSpellLevel(classEntry.key, character.level) : 0;
  const allowedTraditions = classEntry ? CLASS_TRADITIONS[classEntry.key] : undefined;

  if ((!classEntry || Object.keys(spellSlots).length === 0) && character.spells.length > 0) {
    errors.push({
      field: 'spells',
      code: VALIDATION_ERROR_CODES.CLASS_CANNOT_CAST,
      message: `${classEntry?.name ?? 'This class'} does not grant spell slots.`,
      url: classEntry?.url
    });
  }

  const spellsByLevel = new Map<number, number>();
  for (const spellSelection of character.spells) {
    const entry = catalogs.spells.get(spellSelection.key);
    if (!entry) {
      errors.push({
        field: 'spells',
        code: VALIDATION_ERROR_CODES.CATALOG_MISSING,
        message: `Spell ${spellSelection.key} is not recognised.`
      });
      continue;
    }
    if (!entry.pfsLegal) {
      errors.push({
        field: 'spells',
        code: VALIDATION_ERROR_CODES.NOT_PFS_LEGAL,
        message: `${entry.name} is not Pathfinder Society legal.`,
        url: entry.url
      });
      continue;
    }
    if (spellSelection.level > character.level || (maxSpellLevel && spellSelection.level > maxSpellLevel)) {
      errors.push({
        field: 'spells',
        code: VALIDATION_ERROR_CODES.SPELL_LEVEL_TOO_HIGH,
        message: `${entry.name} is above the character's maximum spell level.`,
        url: entry.url
      });
    }
    if (allowedTraditions) {
      const traditions = extractTraditions(entry);
      const matchesTradition = traditions.length === 0 || traditions.some((trad) => allowedTraditions.includes(trad));
      if (!matchesTradition) {
        errors.push({
          field: 'spells',
          code: VALIDATION_ERROR_CODES.SPELL_TRADITION_INVALID,
          message: `${entry.name} is not part of the ${allowedTraditions.join(', ')} traditions.`,
          url: entry.url
        });
      }
    }
    spellsByLevel.set(spellSelection.level, (spellsByLevel.get(spellSelection.level) ?? 0) + 1);
  }

  for (const [level, count] of spellsByLevel) {
    const allowed = spellSlots[level] ?? 0;
    if (allowed && count > allowed) {
      errors.push({
        field: 'spells',
        code: VALIDATION_ERROR_CODES.SPELL_SLOTS_EXCEEDED,
        message: `Prepared ${count} level ${level} spells but only ${allowed} slots are available.`,
        url: classEntry?.url
      });
    }
  }

  const itemsCatalog = catalogs.items;
  const wealth = sumWealth(character.gear, itemsCatalog);
  errors.push(...wealth.issues);

  if (character.level in WBL_TABLE && wealth.total > (WBL_TABLE[character.level] ?? Infinity)) {
    errors.push({
      field: 'gear',
      code: VALIDATION_ERROR_CODES.OVER_WBL,
      message: `Total gear value ${wealth.total} gp exceeds the WBL cap of ${WBL_TABLE[character.level]} gp.`,
      url: undefined
    });
  } else if (character.level in WBL_TABLE && wealth.total > 0.9 * WBL_TABLE[character.level]) {
    warnings.push({
      field: 'gear',
      code: 'NEAR_WBL_LIMIT',
      message: 'Total gear value is near the Pathfinder Society cap. Consider banking some wealth.'
    });
  }

  const grants = new Set<z.infer<typeof CompanionTypeSchema>>();
  if (classEntry) {
    parseGrantTags(classEntry).forEach((grant) => grants.add(grant));
  }
  selectedFeats
    .filter((feat) => selectedFeatsSet.has(feat.key))
    .forEach((feat) => {
      parseGrantTags(feat).forEach((grant) => grants.add(grant));
    });

  if (character.companions?.length) {
    for (const companion of character.companions) {
      if (!CompanionTypeSchema.safeParse(companion.type).success) {
        continue;
      }
      if (!grants.has(companion.type)) {
        errors.push({
          field: 'companions',
          code: VALIDATION_ERROR_CODES.COMPANION_NOT_GRANTED,
          message: `${companion.name ?? companion.type} requires a class feature or feat that grants a ${companion.type}.`
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function buildVersionSummary(
  previous: CharacterInput | null,
  next: CharacterInput,
  itemsCatalog: Map<string, CatalogEntry>
): VersionSummary {
  const previousFeats = new Set(previous?.feats?.map((feat) => feat.key) ?? []);
  const nextFeats = new Set(next.feats.map((feat) => feat.key));
  const addedFeats = Array.from(nextFeats).filter((key) => !previousFeats.has(key));
  const removedFeats = Array.from(previousFeats).filter((key) => !nextFeats.has(key));

  const previousWealth = sumWealth(previous?.gear ?? [], itemsCatalog).total;
  const nextWealth = sumWealth(next.gear, itemsCatalog).total;

  const spellCountByLevel: Record<number, number> = {};
  for (const spell of next.spells) {
    spellCountByLevel[spell.level] = (spellCountByLevel[spell.level] ?? 0) + 1;
  }

  return {
    addedFeats,
    removedFeats,
    goldDelta: Number((nextWealth - previousWealth).toFixed(2)),
    spellCountByLevel
  };
}
