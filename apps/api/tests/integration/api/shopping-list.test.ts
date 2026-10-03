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

describe.skipIf(!dbAvailable)('shopping list API', () => {
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

  it('creates, lists, merges duplicate names, toggles done, and clears checked items', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/shopping-list/items',
      payload: {
        items: [
          { name: 'Olive oil', quantity: 2, unit: 'tbsp', category: 'Pantry' },
          { name: 'Lemon', quantity: 1, unit: 'piece', category: 'Produce' },
        ],
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().data).toHaveLength(2);
    expect(created.json().data[0]).toMatchObject({
      name: 'Olive oil',
      quantity: 2,
      unit: 'tbsp',
      done: false,
      fromRecipeCount: 0,
      source: 'MANUAL',
    });

    const listed = await app.inject({ method: 'GET', url: '/api/v1/shopping-list' });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().data).toHaveLength(2);
    expect(listed.json().meta.total).toBe(2);

    const merged = await app.inject({
      method: 'POST',
      url: '/api/v1/shopping-list/items',
      payload: { items: [{ name: 'olive oil', quantity: 3, unit: 'tbsp' }] },
    });
    expect(merged.statusCode).toBe(201);
    expect(merged.json().data).toHaveLength(1);
    expect(merged.json().data[0]).toMatchObject({
      canonicalName: 'olive oil',
      quantity: 5,
      unit: 'tbsp',
      fromRecipeCount: 1,
    });

    const afterMerge = await app.inject({ method: 'GET', url: '/api/v1/shopping-list' });
    expect(afterMerge.json().data).toHaveLength(2);

    const lemon = (afterMerge.json().data as Array<{ id: string; canonicalName: string }>).find(
      (item) => item.canonicalName === 'lemon',
    );
    expect(lemon).toBeTruthy();
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/v1/shopping-list/items/${lemon!.id}`,
      payload: { done: true },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().data.done).toBe(true);

    const unchecked = await app.inject({
      method: 'GET',
      url: '/api/v1/shopping-list?done=false',
    });
    expect(unchecked.json().data).toHaveLength(1);
    expect(unchecked.json().data[0].canonicalName).toBe('olive oil');

    const cleared = await app.inject({
      method: 'POST',
      url: '/api/v1/shopping-list/clear-done',
    });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json().data).toEqual({ deleted: true, count: 1 });

    const remaining = await app.inject({ method: 'GET', url: '/api/v1/shopping-list' });
    expect(remaining.json().data).toHaveLength(1);
    expect(remaining.json().data[0].canonicalName).toBe('olive oil');
  });

  it('adds from a recipe and skips ingredients already in the pantry', async () => {
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

    const added = await app.inject({
      method: 'POST',
      url: '/api/v1/shopping-list/from-recipe',
      payload: { recipeId },
    });
    expect(added.statusCode).toBe(201);
    const addedItems = added.json().data as Array<{
      canonicalName: string | null;
      name: string;
      source: string;
      sourceRecipeId: string | null;
      fromRecipeCount: number;
    }>;
    const skipKey = (skip.canonicalName ?? skip.name).trim().toLowerCase();
    expect(
      addedItems.some(
        (item) => (item.canonicalName ?? item.name).trim().toLowerCase() === skipKey,
      ),
    ).toBe(false);
    expect(addedItems.length).toBe(ingredients.length - 1);
    for (const item of addedItems) {
      expect(item.source).toBe('RECIPE');
      expect(item.sourceRecipeId).toBe(recipeId);
      expect(item.fromRecipeCount).toBe(1);
    }

    const listed = await app.inject({ method: 'GET', url: '/api/v1/shopping-list' });
    expect(listed.json().data).toHaveLength(ingredients.length - 1);
  });
});
