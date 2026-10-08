import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp } from '../../helpers/build-test-app.js';
import { createTestContainer } from '../../../src/shared/di/container.js';
import {
  disconnectTestDatabase,
  getTestPrisma,
  isDatabaseAvailable,
  resetDatabase,
} from '../../helpers/database.js';

const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)('recipe API endpoints', () => {
  let app: FastifyInstance;
  const prisma = getTestPrisma();
  const container = createTestContainer({ enableMediaProcessing: false });

  beforeAll(async () => {
    await resetDatabase(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    app = await buildTestApp({ container: createTestContainer({ enableMediaProcessing: false }) });
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe('POST /api/v1/recipes/extract', () => {
    it('creates an extraction job and returns 202', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/recipes/extract',
        payload: {
          url: 'https://example.com/fake-recipe',
          outputLanguage: 'en',
        },
      });

      expect(response.statusCode).toBe(202);
      expect(response.json().data).toMatchObject({
        jobId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        status: 'queued',
      });
    });

    it('returns 200 with deduplicated result for same URL', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/recipes/extract',
        payload: { url: 'https://example.com/fake-recipe' },
      });

      const second = await app.inject({
        method: 'POST',
        url: '/api/v1/recipes/extract',
        payload: { url: 'https://example.com/fake-recipe' },
      });

      expect(second.statusCode).toBe(200);
      expect(second.json().data.deduplicated).toBe(true);
      expect(second.json().data.recipeId).toBeTruthy();
    });

    it('rejects invalid URLs with 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/recipes/extract',
        payload: { url: 'not-a-url' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/recipes/extract/jobs/:id', () => {
    it('returns job status after extraction completes', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/v1/recipes/extract',
        payload: { url: 'https://example.com/fake-recipe' },
      });

      const jobId = created.json().data.jobId as string;

      const status = await app.inject({
        method: 'GET',
        url: `/api/v1/recipes/extract/jobs/${jobId}`,
      });

      expect(status.statusCode).toBe(200);
      expect(status.json().data).toMatchObject({
        id: jobId,
        status: 'COMPLETED',
        progress: 100,
        recipeId: expect.any(String),
      });
    });

    it('returns 404 for unknown job', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/recipes/extract/jobs/33333333-3333-4333-8333-333333333333',
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('JOB_NOT_FOUND');
    });
  });

  describe('GET /api/v1/recipes/:id', () => {
    it('returns full recipe with ingredients and steps', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/v1/recipes/extract',
        payload: { url: 'https://example.com/fake-recipe' },
      });

      const jobId = created.json().data.jobId as string;
      const jobStatus = await app.inject({
        method: 'GET',
        url: `/api/v1/recipes/extract/jobs/${jobId}`,
      });
      const recipeId = jobStatus.json().data.recipeId as string;

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/recipes/${recipeId}`,
      });

      expect(response.statusCode).toBe(200);
      const recipe = response.json().data;
      expect(recipe.title).toBe('Fake pasta recipe');
      expect(recipe.revisionNumber).toBe(0);
      expect(recipe.categories.length).toBeGreaterThan(0);
      expect(recipe.ingredients.length).toBeGreaterThan(0);
      expect(recipe.steps.length).toBeGreaterThan(0);
      expect(recipe.confidence).toBeGreaterThan(0);
      expect(recipe.source.author).toBe('fixture-chef');
      expect(recipe.source.thumbnailUrl).toBe('https://example.com/fake-thumb.jpg');
      expect(recipe.calories).toBeGreaterThan(0);
      expect(['stated', 'estimated']).toContain(recipe.nutritionSource);
      expect(recipe.nutrition).toEqual({
        proteinGrams: expect.any(Number),
        carbsGrams: expect.any(Number),
        fatGrams: expect.any(Number),
      });
      expect(recipe.source.sourceLabel).toEqual(expect.any(String));
      for (const ingredient of recipe.ingredients) {
        expect(ingredient.category).toEqual(expect.any(String));
        expect(ingredient.metric).toEqual({
          quantity: expect.toBeOneOf([null, expect.any(String)]),
          unit: expect.toBeOneOf([null, expect.any(String)]),
        });
        expect(ingredient.imperial).toEqual({
          quantity: expect.toBeOneOf([null, expect.any(String)]),
          unit: expect.toBeOneOf([null, expect.any(String)]),
        });
      }
      for (const step of recipe.steps) {
        expect(step.stage).toEqual(expect.any(String));
        expect(Array.isArray(step.ingredientRefs)).toBe(true);
        expect(step).toHaveProperty('temperatureCelsius');
        expect(step).toHaveProperty('temperatureFahrenheit');
      }
      expect(recipe.cuisine === null || typeof recipe.cuisine === 'string').toBe(true);
      expect(recipe).toHaveProperty('difficulty');
      expect([null, 'Easy', 'Medium', 'Hard']).toContain(recipe.difficulty);
      expect(recipe).toHaveProperty('minutes');
      expect(recipe.minutes === null || typeof recipe.minutes === 'number').toBe(true);
    });
  });

  describe('GET /api/v1/recipes', () => {
    it('lists recipes with pagination', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/recipes/extract',
        payload: { url: 'https://example.com/fake-recipe' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/recipes?page=1&pageSize=10',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.length).toBeGreaterThan(0);
      expect(response.json().meta).toMatchObject({
        page: 1,
        pageSize: 10,
        total: expect.any(Number),
      });

      const item = response.json().data[0];
      expect(item).toMatchObject({
        creator: 'fixture-chef',
        thumbnailUrl: 'https://example.com/fake-thumb.jpg',
        ingredientCount: expect.any(Number),
      });
      expect(item.sourceLabel).toEqual(expect.any(String));
    });

    it('returns recipes matching q', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/recipes/extract',
        payload: { url: 'https://example.com/fake-recipe' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/recipes?q=pasta',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.length).toBeGreaterThan(0);
      expect(response.json().data[0].title).toBe('Fake pasta recipe');
    });

    it('returns an empty list when q matches nothing', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/recipes/extract',
        payload: { url: 'https://example.com/fake-recipe' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/recipes?q=zzz-no-match',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual([]);
    });
  });

  describe('DELETE /api/v1/recipes/:id', () => {
    it('deletes a recipe', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/v1/recipes/extract',
        payload: { url: 'https://example.com/fake-recipe' },
      });

      const jobId = created.json().data.jobId as string;
      const jobStatus = await app.inject({
        method: 'GET',
        url: `/api/v1/recipes/extract/jobs/${jobId}`,
      });
      const recipeId = jobStatus.json().data.recipeId as string;

      const deleted = await app.inject({
        method: 'DELETE',
        url: `/api/v1/recipes/${recipeId}`,
      });

      expect(deleted.statusCode).toBe(200);
      expect(deleted.json().data.deleted).toBe(true);

      const fetched = await app.inject({
        method: 'GET',
        url: `/api/v1/recipes/${recipeId}`,
      });
      expect(fetched.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/v1/recipes/:id', () => {
    it('updates recipe title and GET reflects the change', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/v1/recipes/extract',
        payload: { url: 'https://example.com/fake-recipe' },
      });

      const jobId = created.json().data.jobId as string;
      const jobStatus = await app.inject({
        method: 'GET',
        url: `/api/v1/recipes/extract/jobs/${jobId}`,
      });
      const recipeId = jobStatus.json().data.recipeId as string;

      const patched = await app.inject({
        method: 'PATCH',
        url: `/api/v1/recipes/${recipeId}`,
        payload: { title: 'Edited pasta recipe' },
      });

      expect(patched.statusCode).toBe(200);
      expect(patched.json().data.title).toBe('Edited pasta recipe');

      const fetched = await app.inject({
        method: 'GET',
        url: `/api/v1/recipes/${recipeId}`,
      });

      expect(fetched.statusCode).toBe(200);
      expect(fetched.json().data.title).toBe('Edited pasta recipe');
    });

    it('returns 404 RECIPE_NOT_FOUND for unknown uuid', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/recipes/33333333-3333-4333-8333-333333333333',
        payload: { title: 'Does not exist' },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('RECIPE_NOT_FOUND');
    });
  });

  void container;
});
