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

export async function POST(req: Request) {
  const json = await req.json();
  const parseResult = characterSchema.safeParse(json);

  if (!parseResult.success) {
    const issues: ValidationIssue[] = parseResult.error.issues.map((issue) => ({
      field: String(issue.path[0] ?? 'form'),
      code: 'SCHEMA',
      message: issue.message
    }));
    return NextResponse.json(
      { valid: false, errors: mapSchemaIssues(issues), warnings: [] },
      { status: 400 }
    );
  }

  const payload: CharacterInput = parseResult.data;
  const validation = await validateCharacter(payload);

  console.info('character.validation', {
    valid: validation.valid,
    errors: validation.errors.length,
    warnings: validation.warnings.length
  });

  if (!validation.valid) {
    return NextResponse.json({ valid: false, errors: validation.errors, warnings: validation.warnings }, { status: 422 });
  }

  const itemsCatalog = await getCatalog('items');
  const itemsMap = new Map(itemsCatalog.map((entry) => [entry.key, entry] as const));
  const versionSummary = buildVersionSummary(null, payload, itemsMap);

  const [character, version] = await prisma.$transaction(async (tx) => {
    const created = await tx.character.create({
      data: {
        name: payload.name,
        level: payload.level,
        ancestry: payload.ancestry,
        background: payload.background,
        clazz: payload.clazz,
        subclass: payload.subclass,
        heritage: payload.heritage,
        keyAbility: payload.keyAbility,
        abilities: payload.abilities,
        skills: payload.skills,
        feats: payload.feats,
        spells: payload.spells,
        gear: payload.gear,
        companions: payload.companions,
        legality: 'PFS Legal',
        legalityLog: validation.warnings.map((warning) => warning.message).join("\n") || null
      }
    });

    const createdVersion = await tx.characterVersion.create({
      data: {
        characterId: created.id,
        summary: versionSummary
      }
    });

    return [created, createdVersion] as const;
  });

  console.info('character.save', {
    id: character.id,
    versionId: version.id,
    warnings: validation.warnings.length
  });

  return NextResponse.json(
    { id: character.id, versionId: version.id, valid: true, warnings: validation.warnings },
    { status: 200 }
  );
}
