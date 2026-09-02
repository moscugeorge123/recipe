import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL(
    '../../../prisma/migrations/20260831250000_recipe_engagement_notes/migration.sql',
    import.meta.url,
  ),
  'utf8',
);

describe('recipe engagement notes migration', () => {
  it('backfills completed cook counts before ranking indexes', () => {
    const addColumn = migration.indexOf('ADD COLUMN "completedCookCount"');
    const backfill = migration.indexOf('SET "completedCookCount" = sub.cnt');
    const completedOnly = migration.indexOf(`cs."status" = 'COMPLETED'`);
    const engagementIndex = migration.indexOf('"user_recipes_engagement_idx"');
    const latestIndex = migration.indexOf('"user_recipes_latest_idx"');

    expect(addColumn).toBeGreaterThan(-1);
    expect(backfill).toBeGreaterThan(addColumn);
    expect(completedOnly).toBeGreaterThan(backfill);
    expect(engagementIndex).toBeGreaterThan(backfill);
    expect(latestIndex).toBeGreaterThan(-1);
    expect(migration).toContain('"isFavorite" DESC');
    expect(migration).toContain('"completedCookCount" DESC');
  });

  it('adds optional cook-session linkage on notes without rewriting notes', () => {
    expect(migration).toContain('ALTER TABLE "recipe_notes" ADD COLUMN "cookSessionId" UUID');
    expect(migration).toContain('"recipe_notes_cookSessionId_fkey"');
    expect(migration).toContain('ON DELETE SET NULL');
    expect(migration).not.toMatch(/UPDATE "recipe_notes"/);
    expect(migration).not.toMatch(/UPDATE "recipe_revisions"/);
  });
});
