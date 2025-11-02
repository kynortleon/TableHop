import { z } from 'zod';

export const CatalogTypeSchema = z.enum([
  'classes',
  'ancestries',
  'backgrounds',
  'feats',
  'spells',
  'items'
]);

export type CatalogType = z.infer<typeof CatalogTypeSchema>;

export const CatalogEntrySchema = z.object({
  key: z.string(),
  name: z.string(),
  level: z.number().int().nonnegative(),
  source: z.string(),
  url: z.string().url(),
  tags: z.array(z.string()),
  pfsLegal: z.boolean()
});

export type CatalogEntry = z.infer<typeof CatalogEntrySchema>;

export interface CharacterFormValues {
  name: string;
  level: number;
  ancestry: string;
  background: string;
  clazz: string;
  subclass?: string;
  keyAbility: string;
  abilities: Record<string, number>;
  skills: string[];
  feats: Array<{ key: string; level: number }>;
  spells: Array<{ key: string; level: number }>;
  gear: Array<{ key: string; quantity: number; totalCost: number }>;
}
