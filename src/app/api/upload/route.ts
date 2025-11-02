import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

async function ensureDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  await ensureDir();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const portraitName = `${randomUUID()}-portrait.png`;
  const tokenName = `${randomUUID()}-token.png`;

  const portraitPath = path.join(UPLOAD_DIR, portraitName);
  const tokenPath = path.join(UPLOAD_DIR, tokenName);

  await sharp(buffer).png().toFile(portraitPath);
  await sharp(buffer).resize(400, 400, { fit: 'cover' }).png().toFile(tokenPath);

  return NextResponse.json({
    portraitUrl: `/uploads/${portraitName}`,
    tokenUrl: `/uploads/${tokenName}`
  });
}
