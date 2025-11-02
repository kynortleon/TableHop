export type CatalogType =
  | 'classes'
  | 'ancestries'
  | 'backgrounds'
  | 'feats'
  | 'spells'
  | 'items';

export interface CatalogEntry {
  key: string;
  name: string;
  level: number;
  source: string;
  url: string;
  tags: string[];
  pfsLegal: boolean;
}

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
