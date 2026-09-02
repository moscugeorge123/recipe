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

describe.skipIf(!dbAvailable)('nutrition API', () => {
  const prisma = getTestPrisma();
  let app: FastifyInstance;

  beforeAll(() => resetDatabase(prisma));
  beforeEach(async () => {
    await resetDatabase(prisma);
    app = await buildTestApp({ container: createTestContainer({ enableMediaProcessing: false }) });
  });
  afterEach(() => app.close());
  afterAll(() => disconnectTestDatabase());

  async function importRecipe(): Promise<string> {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/extract',
      payload: { url: 'https://example.com/fake-recipe' },
    });
    const status = await app.inject({
      method: 'GET',
      url: `/api/v1/recipes/extract/jobs/${created.json().data.jobId as string}`,
    });
    return status.json().data.recipeId as string;
  }

  function mapSteps(
    steps: Array<{
      instruction: string;
      durationMinutes: number | null;
      temperature: string | null;
      stage: string;
    }>,
  ): Array<{
    stepOrder: number;
    instruction: string;
    durationMinutes: number | null;
    temperature: string | null;
    stage: string;
  }> {
    return steps.map((step, index) => ({
      stepOrder: index + 1,
      instruction: step.instruction,
      durationMinutes: step.durationMinutes,
      temperature: step.temperature,
      stage: step.stage,
    }));
  }

  it('calculates after import and exposes per-portion and per-100g values', async () => {
    const recipeId = await importRecipe();
    const detail = await app.inject({ method: 'GET', url: `/api/v1/recipes/${recipeId}` });
    expect(detail.statusCode).toBe(200);

    const categories = (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json()
      .data as Array<{ id: string }>;
    const recipe = detail.json().data as {
      revisionNumber: number;
      steps: Array<{
        instruction: string;
        durationMinutes: number | null;
        temperature: string | null;
        stage: string;
      }>;
    };
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/v1/recipes/${recipeId}`,
      payload: {
        expectedRevisionNumber: recipe.revisionNumber,
        servings: 2,
        categoryIds: [categories[0]!.id],
        ingredients: [
          {
            name: 'Spaghetti',
            canonicalName: 'spaghetti',
            quantity: 200,
            unit: 'g',
            preparation: null,
            optional: false,
            emoji: '🍝',
            colorToken: 'peach',
            category: 'Pantry',
            sortOrder: 0,
          },
          {
            name: 'Olive oil',
            canonicalName: 'olive oil',
            quantity: 1,
            unit: 'tbsp',
            preparation: null,
            optional: false,
            emoji: '🥣',
            colorToken: 'peach',
            category: 'Pantry',
            sortOrder: 1,
          },
          {
            name: 'Mystery fruit',
            canonicalName: 'mystery fruit',
            quantity: 1,
            unit: 'piece',
            preparation: null,
            optional: false,
            emoji: '🥣',
            colorToken: 'peach',
            category: 'Produce',
            sortOrder: 2,
          },
        ],
        steps: mapSteps(recipe.steps),
      },
    });
    expect(patched.statusCode).toBe(200);

    const nutrition = await app.inject({
      method: 'GET',
      url: `/api/v1/recipes/${recipeId}/nutrition`,
    });
    expect(nutrition.statusCode).toBe(200);
    const body = nutrition.json().data;
    expect(body.status).toBe('PARTIAL');
    expect(body.updating).toBe(false);
    expect(body.coverage.matched).toBe(2);
    expect(body.coverage.total).toBe(3);
    expect(body.unmatchedIngredients).toContain('Mystery fruit');
    expect(body.totals.calories).toBeGreaterThan(0);
    expect(body.perPortion.calories).toBeGreaterThan(0);
    expect(body.per100g.calories).toBeGreaterThan(0);
    expect(body.provider).toBe('fake');
    expect(body.calculatedAt).toEqual(expect.any(String));

    const cook = await app.inject({
      method: 'POST',
      url: '/api/v1/cook-sessions',
      payload: { recipeId },
    });
    expect([200, 201]).toContain(cook.statusCode);
  });

  it('recalculates after a serving change and accepts a food-match correction', async () => {
    const recipeId = await importRecipe();
    const detail = (
      await app.inject({ method: 'GET', url: `/api/v1/recipes/${recipeId}` })
    ).json().data as {
      revisionNumber: number;
      steps: Array<{
        instruction: string;
        durationMinutes: number | null;
        temperature: string | null;
        stage: string;
      }>;
    };
    const categories = (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json()
      .data as Array<{ id: string }>;

    await app.inject({
      method: 'PATCH',
      url: `/api/v1/recipes/${recipeId}`,
      payload: {
        expectedRevisionNumber: detail.revisionNumber,
        servings: 4,
        categoryIds: [categories[0]!.id],
        ingredients: [
          {
            name: 'Pasta',
            canonicalName: 'pasta',
            quantity: 200,
            unit: 'g',
            preparation: null,
            optional: false,
            emoji: '🍝',
            colorToken: 'peach',
            category: 'Pantry',
            sortOrder: 0,
          },
        ],
        steps: mapSteps(detail.steps),
      },
    });

    const before = (await app.inject({ method: 'GET', url: `/api/v1/recipes/${recipeId}/nutrition` }))
      .json().data;
    expect(before.status).toBe('READY');
    expect(before.servings).toBe(4);

    const recalculated = await app.inject({
      method: 'POST',
      url: `/api/v1/recipes/${recipeId}/nutrition/recalculate`,
    });
    expect(recalculated.statusCode).toBe(200);
    expect(recalculated.json().data.status).toBe('READY');

    const latest = await prisma.recipeRevision.findFirstOrThrow({
      where: { userRecipe: { recipeId } },
      orderBy: { revisionNumber: 'desc' },
      include: { ingredients: true },
    });
    const corrected = await app.inject({
      method: 'PATCH',
      url: `/api/v1/recipes/${recipeId}/nutrition/matches`,
      payload: {
        ingredientId: latest.ingredients[0]!.id,
        fdcId: 'fake:spaghetti',
      },
    });
    expect(corrected.statusCode).toBe(200);
    expect(corrected.json().data.matches[0].matchedFoodId).toBe('fake:spaghetti');
  });

  it('returns 404 for a recipe the profile does not own', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/recipes/00000000-0000-4000-8000-000000000099/nutrition',
    });
    expect(response.statusCode).toBe(404);
  });
});
