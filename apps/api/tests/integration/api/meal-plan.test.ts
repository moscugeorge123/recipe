import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestContainer } from '../../../src/shared/di/container.js';
import { buildTestApp } from '../../helpers/build-test-app.js';
import {
  disconnectTestDatabase,
  getTestPrisma,
  isDatabaseAvailable,
  resetDatabase,
} from '../../helpers/database.js';

const dbAvailable = await isDatabaseAvailable();

const WEEK_FROM = '2026-09-07';
const WEEK_TO = '2026-09-13';

async function importRecipe(
  app: FastifyInstance,
  url = 'https://example.com/fake-recipe',
): Promise<string> {
  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/recipes/extract',
    payload: { url },
  });
  const status = await app.inject({
    method: 'GET',
    url: `/api/v1/recipes/extract/jobs/${created.json().data.jobId as string}`,
  });
  return status.json().data.recipeId as string;
}

describe.skipIf(!dbAvailable)('meal plan API', () => {
  const prisma = getTestPrisma();
  let app: FastifyInstance;

  beforeAll(() => resetDatabase(prisma));
  afterAll(() => disconnectTestDatabase());

  afterEach(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    app = await buildTestApp({
      container: createTestContainer({ enableMediaProcessing: false }),
    });
  });

  it('creates a recipe entry and adds shopping items for non-pantry ingredients', async () => {
    const recipeId = await importRecipe(app);
    const recipe = await app.inject({
      method: 'GET',
      url: `/api/v1/recipes/${recipeId}`,
    });
    expect(recipe.statusCode).toBe(200);
    const ingredients = recipe.json().data.ingredients as Array<{
      name: string;
      canonicalName: string | null;
    }>;
    expect(ingredients.length).toBeGreaterThan(0);
    const skip = ingredients[0]!;

    const pantry = await app.inject({
      method: 'POST',
      url: '/api/v1/pantry/items',
      payload: {
        items: [
          {
            name: skip.name,
            canonicalName: skip.canonicalName ?? skip.name,
          },
        ],
      },
    });
    expect(pantry.statusCode).toBe(201);

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/meal-plan/entries',
      payload: {
        date: WEEK_FROM,
        slot: 'DINNER',
        kind: 'RECIPE',
        recipeId,
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().data).toMatchObject({
      date: WEEK_FROM,
      slot: 'DINNER',
      kind: 'RECIPE',
      recipeId,
      note: null,
    });

    const listed = await app.inject({ method: 'GET', url: '/api/v1/shopping-list' });
    expect(listed.statusCode).toBe(200);
    const shopItems = listed.json().data as Array<{
      canonicalName: string | null;
      name: string;
      source: string;
      sourceRecipeId: string | null;
      sourceMealPlanEntryId: string | null;
    }>;
    const skipKey = (skip.canonicalName ?? skip.name).trim().toLowerCase();
    expect(
      shopItems.some(
        (item) => (item.canonicalName ?? item.name).trim().toLowerCase() === skipKey,
      ),
    ).toBe(false);
    expect(shopItems.length).toBe(ingredients.length - 1);
    for (const item of shopItems) {
      expect(item.source).toBe('MEAL_PLAN');
      expect(item.sourceRecipeId).toBe(recipeId);
      expect(item.sourceMealPlanEntryId).toBe(created.json().data.id);
    }
  });

  it('does not write shopping items when creating a note', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/meal-plan/entries',
      payload: {
        date: WEEK_FROM,
        slot: 'LUNCH',
        kind: 'NOTE',
        note: 'Leftovers from Sunday',
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().data).toMatchObject({
      date: WEEK_FROM,
      slot: 'LUNCH',
      kind: 'NOTE',
      recipeId: null,
      note: 'Leftovers from Sunday',
    });

    const listed = await app.inject({ method: 'GET', url: '/api/v1/shopping-list' });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().data).toHaveLength(0);
  });

  it('deletes shopping rows sourced by a recipe meal plan entry', async () => {
    const recipeId = await importRecipe(app);
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/meal-plan/entries',
      payload: {
        date: WEEK_FROM,
        slot: 'BREAKFAST',
        kind: 'RECIPE',
        recipeId,
      },
    });
    expect(created.statusCode).toBe(201);
    const entryId = created.json().data.id as string;

    const before = await app.inject({ method: 'GET', url: '/api/v1/shopping-list' });
    expect(before.json().data.length).toBeGreaterThan(0);

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/v1/meal-plan/entries/${entryId}`,
    });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json().data).toEqual({ id: entryId, deleted: true });

    const after = await app.inject({ method: 'GET', url: '/api/v1/shopping-list' });
    expect(after.json().data).toHaveLength(0);
  });

  it('lists entries within a Monday-start week and excludes dates outside it', async () => {
    const recipeId = await importRecipe(app);
    const inWeek = await app.inject({
      method: 'POST',
      url: '/api/v1/meal-plan/entries',
      payload: {
        date: WEEK_FROM,
        slot: 'DINNER',
        kind: 'RECIPE',
        recipeId,
      },
    });
    expect(inWeek.statusCode).toBe(201);

    const note = await app.inject({
      method: 'POST',
      url: '/api/v1/meal-plan/entries',
      payload: {
        date: WEEK_TO,
        slot: 'SNACK',
        kind: 'NOTE',
        note: 'Prep fruit',
      },
    });
    expect(note.statusCode).toBe(201);

    const outside = await app.inject({
      method: 'POST',
      url: '/api/v1/meal-plan/entries',
      payload: {
        date: '2026-09-14',
        slot: 'LUNCH',
        kind: 'NOTE',
        note: 'Next week',
      },
    });
    expect(outside.statusCode).toBe(201);

    const listed = await app.inject({
      method: 'GET',
      url: `/api/v1/meal-plan?from=${WEEK_FROM}&to=${WEEK_TO}`,
    });
    expect(listed.statusCode).toBe(200);
    const entries = listed.json().data as Array<{ id: string; date: string }>;
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.id).sort()).toEqual(
      [inWeek.json().data.id, note.json().data.id].sort(),
    );
    expect(entries.every((entry) => entry.date >= WEEK_FROM && entry.date <= WEEK_TO)).toBe(true);
  });
});
