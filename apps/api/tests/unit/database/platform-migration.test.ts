import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL(
    '../../../prisma/migrations/20260831213000_platform_persistence_foundation/migration.sql',
    import.meta.url,
  ),
  'utf8',
);

describe('platform persistence migration', () => {
  it('backfills ownership before enforcing the cook-session constraint', () => {
    const addNullable = migration.indexOf('ALTER TABLE "cook_sessions" ADD COLUMN "userId" UUID;');
    const backfill = migration.indexOf('UPDATE "cook_sessions"');
    const setRequired = migration.indexOf('ALTER COLUMN "userId" SET NOT NULL');

    expect(addNullable).toBeGreaterThan(-1);
    expect(backfill).toBeGreaterThan(addNullable);
    expect(setRequired).toBeGreaterThan(backfill);
  });

  it('copies every existing recipe, ingredient, and step field into revision zero', () => {
    for (const field of [
      'r."title"',
      'r."description"',
      'r."nutrition"',
      'r."rawExtraction"',
      'i."quantity"',
      'i."preparation"',
      'i."provenance"',
      'i."warnings"',
      's."instruction"',
      's."durationMinutes"',
      's."temperature"',
      's."provenance"',
      's."warnings"',
    ]) {
      expect(migration).toContain(field);
    }

    expect(migration).not.toMatch(/UPDATE "recipes"/);
    expect(migration).not.toMatch(/UPDATE "recipe_ingredients"/);
    expect(migration).not.toMatch(/UPDATE "recipe_steps"/);
    expect(migration).toContain('"userRecipeId", "authorUserId", "revisionNumber"');
    expect(migration).toContain('"revisionNumber" >= 0');
  });

  it('uses deterministic singleton/category seeds and append-only revision guards', () => {
    expect(migration).toContain("'00000000-0000-4000-8000-000000000001'");
    expect(migration).toContain("'breakfast', 'Breakfast'");
    expect(migration).toContain("'lunch', 'Lunch'");
    expect(migration).toContain("'dinner', 'Dinner'");
    expect(migration).toContain("'sweet', 'Sweet'");
    expect(migration).toContain('"user_recipes_rating_range"');
    expect(migration).toContain('"categories_userId_slug_key"');
    expect(migration).toContain('"recipe_categories_categoryId_userId_fkey"');
    expect(migration).toContain('CREATE TRIGGER "recipe_revisions_immutable"');
  });
});
