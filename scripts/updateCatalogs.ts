import axios from 'axios';
import { load } from 'cheerio';
import { fetch } from 'undici';
import { promises as fs } from 'node:fs';
import path from 'node:path';

interface CatalogEntry {
  key: string;
  name: string;
  level: number;
  source: string;
  url: string;
  tags: string[];
  pfsLegal: boolean;
}

type CatalogType = 'classes' | 'ancestries' | 'backgrounds' | 'feats' | 'spells' | 'items';

const BASE_URL = 'https://2e.aonprd.com/';

const catalogConfig: Record<CatalogType, { listUrl: string; pattern: RegExp; defaultLevel: number }> = {
  classes: { listUrl: `${BASE_URL}Classes.aspx`, pattern: /Classes.aspx\?ID=/, defaultLevel: 1 },
  ancestries: { listUrl: `${BASE_URL}Ancestries.aspx`, pattern: /Ancestries.aspx\?ID=/, defaultLevel: 0 },
  backgrounds: { listUrl: `${BASE_URL}Backgrounds.aspx`, pattern: /Backgrounds.aspx\?ID=/, defaultLevel: 0 },
  feats: { listUrl: `${BASE_URL}Feats.aspx`, pattern: /Feats.aspx\?ID=/, defaultLevel: 1 },
  spells: { listUrl: `${BASE_URL}Spells.aspx`, pattern: /Spells.aspx\?ID=/, defaultLevel: 1 },
  items: { listUrl: `${BASE_URL}Equipment.aspx`, pattern: /Equipment.aspx\?ID=/, defaultLevel: 0 }
};

const bannedTags = ['Uncommon', 'Rare', 'Unique', 'Artifact', 'NPC', 'Limited'];

const DATA_DIR = path.join(process.cwd(), 'data', 'catalogs');

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

async function parseDetail(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    return { source: 'Unknown', tags: [] as string[], level: NaN };
  }
  const html = await res.text();
  const $ = load(html);
  const sourceText = $('b:contains("Source")').next('a, i').first().text().trim() || 'Unknown';
  const traitText = $('b:contains("Traits")').parent().text() || '';
  const tags = traitText
    .split(/[,•]/)
    .map((tag) => tag.replace('Traits', '').trim())
    .filter((tag) => tag.length > 0);
  const levelText = $('b:contains("Level")').next().text().trim() || $('span:contains("Level")').text();
  const levelMatch = levelText.match(/Level\s*(\d+)/i);
  const level = levelMatch ? Number(levelMatch[1]) : NaN;
  return { source: sourceText, tags, level };
}

function determineLegality(entry: { name: string; tags: string[] }) {
  const haystack = `${entry.name} ${entry.tags.join(' ')}`;
  return !bannedTags.some((tag) => haystack.includes(tag));
}

async function updateCatalog(type: CatalogType) {
  console.log(`Updating ${type}…`);
  const config = catalogConfig[type];
  const { data } = await axios.get(config.listUrl);
  const $ = load(data);
  const seen = new Set<string>();
  const entries: CatalogEntry[] = [];

  $('a[href]').each((_idx, el) => {
    const href = $(el).attr('href');
    if (!href || !config.pattern.test(href)) return;
    const name = $(el).text().trim();
    if (!name) return;
    const url = new URL(href, BASE_URL).toString();
    const key = slugify(name);
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({
      key,
      name,
      level: config.defaultLevel,
      source: 'Unknown',
      url,
      tags: [],
      pfsLegal: true
    });
  });

  for (const entry of entries) {
    try {
      const detail = await parseDetail(entry.url);
      entry.source = detail.source || 'Unknown';
      entry.tags = detail.tags;
      if (!Number.isNaN(detail.level)) {
        entry.level = detail.level;
      }
      entry.pfsLegal = determineLegality(entry);
    } catch (error) {
      console.warn(`Failed to parse detail for ${entry.name}`, error);
    }
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  const filePath = path.join(DATA_DIR, `${type}.json`);
  await fs.writeFile(filePath, JSON.stringify(entries, null, 2));
  console.log(`Saved ${entries.length} ${type} entries to ${filePath}`);
}

async function main() {
  for (const type of Object.keys(catalogConfig) as CatalogType[]) {
    await updateCatalog(type);
  }
}

main().catch((error) => {
  console.error('Failed to update catalogs', error);
  process.exit(1);
});
