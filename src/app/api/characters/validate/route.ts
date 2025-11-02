import { NextResponse } from 'next/server';
import { characterSchema } from '@/lib/validators/character';
import { validateCharacter } from '@/server/validate/pfs';
import type { ValidationIssue } from '@/types/pfs';

export async function POST(req: Request) {
  const json = await req.json();
  const parsed = characterSchema.safeParse(json);

  if (!parsed.success) {
    const errors: ValidationIssue[] = parsed.error.issues.map((issue) => ({
      field: String(issue.path[0] ?? 'form'),
      code: 'SCHEMA',
      message: issue.message
    }));
    return NextResponse.json({ valid: false, errors, warnings: [] }, { status: 200 });
  }

  const result = await validateCharacter(parsed.data);

  console.info('character.validate.api', {
    valid: result.valid,
    errors: result.errors.length,
    warnings: result.warnings.length
  });

  return NextResponse.json(result, { status: 200 });
}
