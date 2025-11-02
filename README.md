# TableHop Character Vault

TableHop is a Pathfinder 2e “drop-in” platform focused on building Pathfinder Society–legal characters. This repository contains the first module: a full-stack Character Vault built with Next.js 14, Prisma, and Tailwind CSS.

## Stack

- **Framework:** Next.js 14 with the App Router and TypeScript
- **Styling:** Tailwind CSS + tailwindcss-animate
- **Database:** PostgreSQL accessed through Prisma
- **Validation:** Zod schemas with server-side legality checks
- **Scraping:** Archives of Nethys content fetched with axios, cheerio, and undici

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy `.env.example` to `.env` and update the `DATABASE_URL` for your PostgreSQL or Supabase instance.

   ```bash
   cp .env.example .env
   ```

3. **Generate the Prisma client**

   ```bash
   npx prisma generate
   ```

4. **Apply migrations**

   ```bash
   npx prisma migrate deploy
   ```

5. **Sync Archives of Nethys catalogs**

   ```bash
   npm run sync:aon
   ```

   This script populates the JSON catalogs in `data/catalogs/*.json` with PFS-legal options.

6. **Run the development server**

   ```bash
   npm run dev
   ```

   Open <http://localhost:3000> to access the Character Vault.

## Seed Data

The project reads PFS-legal options from the JSON catalogs stored in `data/catalogs`. Run `npm run sync:aon` regularly (or automate it daily) to keep the data in sync with <https://2e.aonprd.com/>.

## Scripts

- `npm run dev` – start the Next.js development server
- `npm run build` – create a production build
- `npm run start` – run the production server
- `npm run sync:aon` – refresh Archives of Nethys data and regenerate catalogs
- `npm run prisma:migrate` – apply database migrations
- `npm run prisma:generate` – regenerate the Prisma client

## Project Structure

```
src/
  app/
    (vault)/characters      # Character listing, creation wizard, and detail pages
    api/                    # REST endpoints for catalogs, characters, and uploads
  components/               # UI components and the character creation wizard
  lib/                      # Database client, AoN utilities, Zod validators
scripts/updateCatalogs.ts   # AoN sync script
prisma/schema.prisma        # Database schema
```

## Pathfinder Society Legality

Every character goes through two layers of validation:

1. **Zod validation** ensures fields conform to the expected shape and PF2e point-buy boundaries.
2. **Catalog cross-checking** confirms every ancestry, background, class, feat, spell, and item is flagged as PFS-legal before it is stored in the database.

A live legality badge is shown throughout the character creation flow and on the Character Vault listing.
