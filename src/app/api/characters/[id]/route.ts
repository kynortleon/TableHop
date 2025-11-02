import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { characterSchema, type CharacterInput } from '@/lib/validators/character';
import { getCatalog } from '@/lib/aon/catalog';
import { buildVersionSummary, validateCharacter } from '@/server/validate/pfs';
import type { ValidationIssue } from '@/types/pfs';

function mapSchemaIssues(issues: ValidationIssue[]): ValidationIssue[] {
  return issues.map((issue) => ({
    field: issue.field,
    code: issue.code,
    message: issue.message,
    url: issue.url
  }));
}

function recordToInput(record: any): CharacterInput {
  return {
    name: record.name,
    level: record.level,
    ancestry: record.ancestry,
    heritage: record.heritage ?? '',
    background: record.background,
    clazz: record.clazz,
    subclass: record.subclass ?? undefined,
    keyAbility: record.keyAbility,
    abilities: (record.abilities ?? {}) as CharacterInput['abilities'],
    skills: Array.isArray(record.skills) ? (record.skills as string[]) : [],
    feats: Array.isArray(record.feats) ? (record.feats as CharacterInput['feats']) : [],
    spells: Array.isArray(record.spells) ? (record.spells as CharacterInput['spells']) : [],
    gear: Array.isArray(record.gear) ? (record.gear as CharacterInput['gear']) : [],
    companions: Array.isArray(record.companions)
      ? (record.companions as CharacterInput['companions'])
      : []
  };
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const json = await req.json();
  const parsed = characterSchema.safeParse(json);

  if (!parsed.success) {
    const issues: ValidationIssue[] = parsed.error.issues.map((issue) => ({
      field: String(issue.path[0] ?? 'form'),
      code: 'SCHEMA',
      message: issue.message
    }));
    return NextResponse.json(
      { valid: false, errors: mapSchemaIssues(issues), warnings: [] },
      { status: 400 }
    );
  }

  const existing = await prisma.character.findUnique({ where: { id: params.id } });

  if (!existing) {
    return NextResponse.json({ error: 'Character not found' }, { status: 404 });
  }

  const payload: CharacterInput = parsed.data;
  const validation = await validateCharacter(payload);

  console.info('character.update.validation', {
    id: params.id,
    valid: validation.valid,
    errors: validation.errors.length,
    warnings: validation.warnings.length
  });

  if (!validation.valid) {
    return NextResponse.json({ valid: false, errors: validation.errors, warnings: validation.warnings }, { status: 422 });
  }

  const itemsCatalog = await getCatalog('items');
  const itemsMap = new Map(itemsCatalog.map((entry) => [entry.key, entry] as const));
  const previousInput = recordToInput(existing);
  const versionSummary = buildVersionSummary(previousInput, payload, itemsMap);

  const [updated, version] = await prisma.$transaction(async (tx) => {
    const updatedCharacter = await tx.character.update({
      where: { id: params.id },
      data: {
        name: payload.name,
        level: payload.level,
        ancestry: payload.ancestry,
        heritage: payload.heritage,
        background: payload.background,
        clazz: payload.clazz,
        subclass: payload.subclass,
        keyAbility: payload.keyAbility,
        abilities: payload.abilities,
        skills: payload.skills,
        feats: payload.feats,
        spells: payload.spells,
        gear: payload.gear,
        companions: payload.companions,
        legality: 'PFS Legal',
        legalityLog: validation.warnings.map((warning) => warning.message).join('
') || null
      }
    });

    const createdVersion = await tx.characterVersion.create({
      data: {
        characterId: updatedCharacter.id,
        summary: versionSummary
      }
    });

    return [updatedCharacter, createdVersion] as const;
  });

  console.info('character.update.save', {
    id: updated.id,
    versionId: version.id,
    warnings: validation.warnings.length
  });

  return NextResponse.json(
    { id: updated.id, versionId: version.id, valid: true, warnings: validation.warnings },
    { status: 200 }
  );
}
