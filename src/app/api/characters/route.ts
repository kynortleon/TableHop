import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { prisma } from '@/lib/db/client';
import { characterSchema } from '@/lib/validators/character';
import { validateCharacterAgainstCatalogs } from '@/lib/aon/legality';

export async function POST(req: Request) {
  const json = await req.json();
  const parseResult = characterSchema.safeParse(json);

  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.flatten() }, { status: 400 });
  }

  const legality = await validateCharacterAgainstCatalogs({
    ancestry: parseResult.data.ancestry,
    background: parseResult.data.background,
    clazz: parseResult.data.clazz,
    feats: parseResult.data.feats,
    spells: parseResult.data.spells,
    gear: parseResult.data.gear
  });

  const character = await prisma.character.create({
    data: {
      name: parseResult.data.name,
      level: parseResult.data.level,
      ancestry: parseResult.data.ancestry,
      background: parseResult.data.background,
      clazz: parseResult.data.clazz,
      subclass: parseResult.data.subclass,
      keyAbility: parseResult.data.keyAbility,
      abilities: parseResult.data.abilities,
      skills: parseResult.data.skills,
      feats: parseResult.data.feats,
      spells: parseResult.data.spells,
      gear: parseResult.data.gear,
      legality: legality.legal ? 'PFS Legal' : 'Invalid',
      legalityLog: legality.reasons.join('\n')
    }
  });

  return NextResponse.json({
    character,
    legality
  });
}
