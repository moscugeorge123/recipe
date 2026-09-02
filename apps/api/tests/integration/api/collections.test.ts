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

async function importRecipe(app: FastifyInstance, url: string): Promise<string> {
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

describe.skipIf(!dbAvailable)('collections API', () => {
  const prisma = getTestPrisma();
  let app: FastifyInstance;

  beforeAll(() => resetDatabase(prisma));
  beforeEach(async () => {
    await resetDatabase(prisma);
    app = await buildTestApp({
      container: createTestContainer({ enableMediaProcessing: false }),
    });
  });
  afterEach(() => app.close());
  afterAll(() => disconnectTestDatabase());

  it('creates, lists, renames, and deletes a collection without deleting recipes', async () => {
    const recipeId = await importRecipe(app, 'https://example.com/fake-recipe');

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/collections',
      payload: { name: 'Appetizers', recipeIds: [recipeId] },
    });
    expect(created.statusCode).toBe(201);
    const collection = created.json().data as { id: string; name: string };
    expect(collection).toMatchObject({
      name: 'Appetizers',
      recipeCount: 1,
      recipeIds: [recipeId],
    });
    expect(created.json().data.coverPreviews).toEqual([
      expect.objectContaining({
        recipeId,
        title: expect.any(String),
        thumbnailUrl: 'https://example.com/fake-thumb.jpg',
      }),
    ]);

    const listed = await app.inject({ method: 'GET', url: '/api/v1/collections' });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().data).toHaveLength(1);
    expect(listed.json().meta.total).toBe(1);

    const renamed = await app.inject({
      method: 'PATCH',
      url: `/api/v1/collections/${collection.id}`,
      payload: { name: 'Friends Dinners' },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().data.name).toBe('Friends Dinners');

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/v1/collections/${collection.id}`,
    });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json().data).toEqual({ id: collection.id, deleted: true });

    const recipe = await app.inject({ method: 'GET', url: `/api/v1/recipes/${recipeId}` });
    expect(recipe.statusCode).toBe(200);
    expect(recipe.json().data.id).toBe(recipeId);

    const empty = await app.inject({ method: 'GET', url: '/api/v1/collections' });
    expect(empty.json().data).toHaveLength(0);
  });

  it('rejects duplicate names for the same user', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/collections',
      payload: { name: 'Appetizers' },
    });
    expect(first.statusCode).toBe(201);

    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/v1/collections',
      payload: { name: 'appetizers' },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe('COLLECTION_NAME_CONFLICT');
  });

  it('adds, refuses duplicate membership as idempotent, reorders, and removes recipes', async () => {
    const first = await importRecipe(app, 'https://example.com/fake-recipe');
    const second = await importRecipe(app, 'https://example.com/fake-recipe-b');
    const third = await importRecipe(app, 'https://example.com/fake-recipe-c');

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/collections',
      payload: { name: 'Weeknights' },
    });
    const id = created.json().data.id as string;

    const addFirst = await app.inject({
      method: 'POST',
      url: `/api/v1/collections/${id}/recipes`,
      payload: { recipeId: first },
    });
    expect(addFirst.statusCode).toBe(201);

    const addAgain = await app.inject({
      method: 'POST',
      url: `/api/v1/collections/${id}/recipes`,
      payload: { recipeId: first },
    });
    expect(addAgain.statusCode).toBe(200);
    expect(addAgain.json().data.recipeIds).toEqual([first]);

    await app.inject({
      method: 'POST',
      url: `/api/v1/collections/${id}/recipes`,
      payload: { recipeId: second },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/collections/${id}/recipes`,
      payload: { recipeId: third },
    });

    const reordered = await app.inject({
      method: 'PUT',
      url: `/api/v1/collections/${id}/recipes`,
      payload: { recipeIds: [third, first, second] },
    });
    expect(reordered.statusCode).toBe(200);
    const reorderedBody = reordered.json().data as {
      recipeIds: string[];
      recipes: Array<{ id: string; sortOrder: number }>;
    };
    expect(reorderedBody.recipeIds).toEqual([third, first, second]);
    expect(reorderedBody.recipes.map((item) => item.id)).toEqual([third, first, second]);
    expect(reorderedBody.recipes.map((item) => item.sortOrder)).toEqual([0, 1, 2]);

    const badOrder = await app.inject({
      method: 'PUT',
      url: `/api/v1/collections/${id}/recipes`,
      payload: { recipeIds: [first, second] },
    });
    expect(badOrder.statusCode).toBe(400);

    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/v1/collections/${id}/recipes/${first}`,
    });
    expect(removed.statusCode).toBe(200);
    expect(removed.json().data.recipeIds).toEqual([third, second]);

    const missing = await app.inject({
      method: 'DELETE',
      url: `/api/v1/collections/${id}/recipes/${first}`,
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('COLLECTION_MEMBER_NOT_FOUND');
  });

  it('returns 404 for unknown collections', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/collections/33333333-3333-4333-8333-333333333333',
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('COLLECTION_NOT_FOUND');
  });
});
