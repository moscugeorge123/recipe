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

async function extractRecipe(
  app: FastifyInstance,
  url = 'https://example.com/fake-recipe',
): Promise<string> {
  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/recipes/extract',
    payload: { url },
  });
  const jobId = created.json().data.jobId as string;
  const jobStatus = await app.inject({
    method: 'GET',
    url: `/api/v1/recipes/extract/jobs/${jobId}`,
  });
  return jobStatus.json().data.recipeId as string;
}

describe.skipIf(!dbAvailable)('cook session API endpoints', () => {
  let app: FastifyInstance;
  const prisma = getTestPrisma();

  beforeAll(async () => {
    await resetDatabase(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const container = createTestContainer({ enableMediaProcessing: false });
    await container.profileBootstrap.ensureDefaults();
    app = await buildTestApp({ container });
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe('POST /api/v1/cook-sessions', () => {
    it('creates an in-progress session', async () => {
      const recipeId = await extractRecipe(app);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/cook-sessions',
        payload: { recipeId },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().data).toMatchObject({
        recipeId,
        status: 'IN_PROGRESS',
        currentStepIndex: 0,
        finishedAt: null,
        totalDurationMs: expect.any(Number),
        steps: [
          {
            stepIndex: 0,
            visitCount: 1,
            durationMs: expect.any(Number),
            firstEnteredAt: expect.any(String),
            lastEnteredAt: expect.any(String),
          },
        ],
        recipe: {
          id: recipeId,
          title: 'Fake pasta recipe',
          stepCount: expect.any(Number),
        },
      });
    });

    it('resumes the existing in-progress session for the same recipe', async () => {
      const recipeId = await extractRecipe(app);

      const first = await app.inject({
        method: 'POST',
        url: '/api/v1/cook-sessions',
        payload: { recipeId },
      });
      const second = await app.inject({
        method: 'POST',
        url: '/api/v1/cook-sessions',
        payload: { recipeId },
      });

      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(200);
      expect(second.json().data.id).toBe(first.json().data.id);
    });

    it('finishes the previous in-progress session when starting another recipe', async () => {
      const firstRecipeId = await extractRecipe(app, 'https://example.com/fake-recipe');
      const secondRecipeId = await extractRecipe(app, 'https://example.com/fake-recipe-b');

      const first = await app.inject({
        method: 'POST',
        url: '/api/v1/cook-sessions',
        payload: { recipeId: firstRecipeId },
      });
      const second = await app.inject({
        method: 'POST',
        url: '/api/v1/cook-sessions',
        payload: { recipeId: secondRecipeId },
      });

      expect(second.statusCode).toBe(201);

      const previous = await app.inject({
        method: 'GET',
        url: `/api/v1/cook-sessions/${first.json().data.id as string}`,
      });

      expect(previous.json().data.status).toBe('STOPPED');
      expect(previous.json().data.finishedAt).toEqual(expect.any(String));
    });

    it('returns 404 RECIPE_NOT_FOUND for an unknown recipe', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/cook-sessions',
        payload: { recipeId: '33333333-3333-4333-8333-333333333333' },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('RECIPE_NOT_FOUND');
    });
  });

  describe('GET /api/v1/cook-sessions', () => {
    it('lists sessions and filters by status', async () => {
      const recipeId = await extractRecipe(app);
      const created = await app.inject({
        method: 'POST',
        url: '/api/v1/cook-sessions',
        payload: { recipeId },
      });
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/cook-sessions/${created.json().data.id as string}`,
        payload: { status: 'COMPLETED' },
      });

      const all = await app.inject({
        method: 'GET',
        url: '/api/v1/cook-sessions',
      });
      const inProgress = await app.inject({
        method: 'GET',
        url: '/api/v1/cook-sessions?status=IN_PROGRESS',
      });
      const completed = await app.inject({
        method: 'GET',
        url: '/api/v1/cook-sessions?status=COMPLETED',
      });

      expect(all.statusCode).toBe(200);
      expect(all.json().data).toHaveLength(1);
      expect(inProgress.json().data).toEqual([]);
      expect(completed.json().data).toHaveLength(1);
      expect(completed.json().data[0].status).toBe('COMPLETED');
    });
  });

  describe('GET /api/v1/cook-sessions/:id', () => {
    it('returns 404 COOK_SESSION_NOT_FOUND for an unknown id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/cook-sessions/33333333-3333-4333-8333-333333333333',
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('COOK_SESSION_NOT_FOUND');
    });
  });

  describe('PATCH /api/v1/cook-sessions/:id', () => {
    it('updates the current step', async () => {
      const recipeId = await extractRecipe(app);
      const created = await app.inject({
        method: 'POST',
        url: '/api/v1/cook-sessions',
        payload: { recipeId },
      });

      const stepCount = created.json().data.recipe.stepCount as number;
      const nextStep = Math.max(0, Math.min(1, stepCount - 1));

      const patched = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cook-sessions/${created.json().data.id as string}`,
        payload: { currentStepIndex: nextStep },
      });

      expect(patched.statusCode).toBe(200);
      expect(patched.json().data.currentStepIndex).toBe(nextStep);
      expect(patched.json().data.status).toBe('IN_PROGRESS');

      const visits = Object.fromEntries(
        (patched.json().data.steps as { stepIndex: number; visitCount: number }[]).map((step) => [
          step.stepIndex,
          step.visitCount,
        ]),
      );
      expect(visits[0]).toBe(1);
      if (nextStep !== 0) {
        expect(visits[nextStep]).toBe(1);
      }
    });

    it('counts a return visit when going back to a previous step', async () => {
      const recipeId = await extractRecipe(app);
      const stepCount = await prisma.recipeStep.count({ where: { recipeId } });
      if (stepCount < 2) {
        await prisma.recipeStep.create({
          data: {
            recipeId,
            stepOrder: stepCount + 1,
            instruction: 'Second test step',
          },
        });
      }

      const created = await app.inject({
        method: 'POST',
        url: '/api/v1/cook-sessions',
        payload: { recipeId },
      });

      const id = created.json().data.id as string;
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/cook-sessions/${id}`,
        payload: { currentStepIndex: 1 },
      });
      const back = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cook-sessions/${id}`,
        payload: { currentStepIndex: 0 },
      });

      expect(back.statusCode).toBe(200);
      const step0 = (back.json().data.steps as { stepIndex: number; visitCount: number }[]).find(
        (step) => step.stepIndex === 0,
      );
      expect(step0?.visitCount).toBe(2);
    });

    it('marks a session completed', async () => {
      const recipeId = await extractRecipe(app);
      const created = await app.inject({
        method: 'POST',
        url: '/api/v1/cook-sessions',
        payload: { recipeId },
      });

      const patched = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cook-sessions/${created.json().data.id as string}`,
        payload: { status: 'COMPLETED' },
      });

      expect(patched.statusCode).toBe(200);
      expect(patched.json().data.status).toBe('COMPLETED');
      expect(patched.json().data.finishedAt).toEqual(expect.any(String));
      expect(patched.json().data.steps[0]).toMatchObject({
        stepIndex: 0,
        visitCount: 1,
        durationMs: expect.any(Number),
      });

      const current = await app.inject({
        method: 'GET',
        url: '/api/v1/cook-sessions?status=IN_PROGRESS',
      });
      expect(current.json().data).toEqual([]);
    });

    it('marks a session stopped', async () => {
      const recipeId = await extractRecipe(app);
      const created = await app.inject({
        method: 'POST',
        url: '/api/v1/cook-sessions',
        payload: { recipeId },
      });

      const patched = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cook-sessions/${created.json().data.id as string}`,
        payload: { status: 'STOPPED' },
      });

      expect(patched.statusCode).toBe(200);
      expect(patched.json().data.status).toBe('STOPPED');
      expect(patched.json().data.finishedAt).toEqual(expect.any(String));
    });

    it('rejects a step index past the last step', async () => {
      const recipeId = await extractRecipe(app);
      const created = await app.inject({
        method: 'POST',
        url: '/api/v1/cook-sessions',
        payload: { recipeId },
      });
      const stepCount = created.json().data.recipe.stepCount as number;

      const patched = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cook-sessions/${created.json().data.id as string}`,
        payload: { currentStepIndex: stepCount },
      });

      expect(patched.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/v1/cook-sessions/:id', () => {
    it('deletes a session', async () => {
      const recipeId = await extractRecipe(app);
      const created = await app.inject({
        method: 'POST',
        url: '/api/v1/cook-sessions',
        payload: { recipeId },
      });
      const id = created.json().data.id as string;

      const deleted = await app.inject({
        method: 'DELETE',
        url: `/api/v1/cook-sessions/${id}`,
      });

      expect(deleted.statusCode).toBe(200);
      expect(deleted.json().data).toEqual({ id, deleted: true });

      const fetched = await app.inject({
        method: 'GET',
        url: `/api/v1/cook-sessions/${id}`,
      });
      expect(fetched.statusCode).toBe(404);
    });
  });
});
