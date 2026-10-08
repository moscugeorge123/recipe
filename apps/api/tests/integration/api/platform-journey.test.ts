import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type {
  LLMInput,
  LLMProvider,
  LLMResult,
} from '../../../src/infrastructure/ai/llm/llm-provider.js';
import { createTestContainer } from '../../../src/shared/di/container.js';
import { buildTestApp } from '../../helpers/build-test-app.js';
import {
  disconnectTestDatabase,
  getTestPrisma,
  isDatabaseAvailable,
  resetDatabase,
} from '../../helpers/database.js';

const dbAvailable = await isDatabaseAvailable();

class ScriptedLLM implements LLMProvider {
  calls = 0;

  async generateStructured<T>(input: LLMInput): Promise<LLMResult<T>> {
    this.calls += 1;
    const user = input.messages.find((message) => message.role === 'user')?.content ?? '';
    const items = user
      .split('\n')
      .filter((line) => /^\d+\t/.test(line))
      .map((line) => {
        const [index, name] = line.split('\t');
        return {
          i: Number(index),
          n: name ?? 'item',
          c: 'Pantry',
          e: '🥣',
          t: 'peach',
          q: null,
          u: null,
          k: 0.88,
        };
      });
    return {
      data: { items } as T,
      model: input.model ?? 'gpt-5-nano',
      usage: { inputTokens: 20, outputTokens: 10 },
      durationMs: 5,
    };
  }
}

interface IngredientJson {
  name: string;
  canonicalName: string | null;
  quantity: string | number | null;
  unit: string | null;
  preparation: string | null;
  optional: boolean;
  emoji: string;
  colorToken: string;
  category: string;
}

interface StepJson {
  instruction: string;
  durationMinutes: number | null;
  temperature: string | null;
  stage: string;
}

interface RecipeDetailJson {
  id: string;
  title: string;
  revisionNumber: number;
  reviewState: string;
  cookCount: number;
  isFavorite: boolean;
  rating: number | null;
  categories: Array<{ slug: string }>;
  ingredients: IngredientJson[];
  steps: StepJson[];
}

async function importRecipe(app: FastifyInstance, url: string): Promise<string> {
  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/recipes/extract',
    payload: { url },
  });
  expect(created.statusCode).toBe(202);
  const status = await app.inject({
    method: 'GET',
    url: `/api/v1/recipes/extract/jobs/${created.json().data.jobId as string}`,
  });
  expect(status.statusCode).toBe(200);
  expect(status.json().data.recipeId).toBeTruthy();
  return status.json().data.recipeId as string;
}

async function completeCook(app: FastifyInstance, recipeId: string): Promise<void> {
  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/cook-sessions',
    payload: { recipeId },
  });
  expect([200, 201]).toContain(created.statusCode);
  const patched = await app.inject({
    method: 'PATCH',
    url: `/api/v1/cook-sessions/${created.json().data.id as string}`,
    payload: { status: 'COMPLETED' },
  });
  expect(patched.statusCode).toBe(200);
}

describe.skipIf(!dbAvailable)('platform journey: import through home ordering', () => {
  const prisma = getTestPrisma();
  const llm = new ScriptedLLM();
  let app: FastifyInstance;

  beforeAll(() => resetDatabase(prisma));
  beforeEach(async () => {
    llm.calls = 0;
    await resetDatabase(prisma);
    app = await buildTestApp({
      container: createTestContainer({ enableMediaProcessing: false, pantryLlm: llm }),
    });
  });
  afterEach(() => app.close());
  afterAll(() => disconnectTestDatabase());

  it('covers import, categories, immutable edit, engagement, collection, pantry, cooks, and home rank', async () => {
    const favoriteId = await importRecipe(app, 'https://example.com/fake-recipe');
    const cookedId = await importRecipe(app, 'https://example.com/fake-recipe-b');

    const imported = (
      await app.inject({ method: 'GET', url: `/api/v1/recipes/${favoriteId}` })
    ).json().data as RecipeDetailJson;
    expect(imported.revisionNumber).toBe(0);
    expect(imported.categories.length).toBeGreaterThan(0);
    expect(imported.ingredients.length).toBeGreaterThan(0);
    expect(imported.ingredients[0]?.emoji).toEqual(expect.any(String));
    expect(imported.ingredients[0]?.category).toEqual(expect.any(String));
    const originalTitle = imported.title;

    const renamed = await app.inject({
      method: 'PATCH',
      url: `/api/v1/recipes/${favoriteId}`,
      payload: { expectedRevisionNumber: 0, title: 'Weeknight pasta bowl' },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().data).toMatchObject({
      title: 'Weeknight pasta bowl',
      revisionNumber: 1,
    });

    const stale = await app.inject({
      method: 'PATCH',
      url: `/api/v1/recipes/${favoriteId}`,
      payload: { expectedRevisionNumber: 0, title: 'Should conflict' },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error.code).toBe('RECIPE_REVISION_CONFLICT');

    const history = await app.inject({
      method: 'GET',
      url: `/api/v1/recipes/${favoriteId}/revisions`,
    });
    expect(history.statusCode).toBe(200);
    const revisions = history.json().data as Array<{
      id: string;
      revisionNumber: number;
      isOriginal: boolean;
    }>;
    const originalRevision = revisions.find((item) => item.isOriginal);
    expect(originalRevision).toBeDefined();
    const restored = await app.inject({
      method: 'POST',
      url: `/api/v1/recipes/${favoriteId}/revisions/${originalRevision!.id}/restore`,
      payload: { expectedRevisionNumber: 1 },
    });
    expect(restored.statusCode).toBe(200);
    expect(restored.json().data).toMatchObject({
      title: originalTitle,
      revisionNumber: 2,
      revisionSource: 'RESTORE',
    });

    const favorited = await app.inject({
      method: 'PUT',
      url: `/api/v1/recipes/${favoriteId}/favorite`,
      payload: {},
    });
    expect(favorited.statusCode).toBe(200);
    expect(favorited.json().data.isFavorite).toBe(true);

    const rated = await app.inject({
      method: 'PUT',
      url: `/api/v1/recipes/${favoriteId}/rating`,
      payload: { rating: 5 },
    });
    expect(rated.statusCode).toBe(200);
    expect(rated.json().data.rating).toBe(5);

    const noted = await app.inject({
      method: 'POST',
      url: `/api/v1/recipes/${favoriteId}/notes`,
      payload: { body: 'salt at the end' },
    });
    expect(noted.statusCode).toBe(201);

    const collected = await app.inject({
      method: 'POST',
      url: '/api/v1/collections',
      payload: { name: 'Weeknights', recipeIds: [favoriteId] },
    });
    expect(collected.statusCode).toBe(201);
    expect(collected.json().data.recipeIds).toEqual([favoriteId]);

    const matchNames = imported.ingredients
      .map((item) => item.canonicalName ?? item.name)
      .filter((name) => name.length > 0)
      .slice(0, 2);
    expect(matchNames.length).toBeGreaterThan(0);
    const savedPantry = await app.inject({
      method: 'POST',
      url: '/api/v1/pantry/items',
      payload: {
        items: matchNames.map((name) => ({
          name,
          canonicalName: name,
          rawText: name,
          source: 'dictionary',
        })),
      },
    });
    expect(savedPantry.statusCode).toBe(201);

    const pantryList = await app.inject({ method: 'GET', url: '/api/v1/pantry' });
    const pantryCanonical = (
      pantryList.json().data as Array<{ canonicalName: string | null; name: string }>
    ).map((item) => (item.canonicalName ?? item.name).toLowerCase());
    for (const name of matchNames) {
      expect(pantryCanonical).toContain(name.toLowerCase());
    }

    const organized = await app.inject({
      method: 'POST',
      url: '/api/v1/pantry/organize',
      payload: { text: 'olive oil\ngochujang' },
    });
    expect(organized.statusCode).toBe(200);
    expect(organized.json().data.meta.fallbackCount).toBeGreaterThanOrEqual(0);
    const unknown = (
      organized.json().data.items as Array<{ rawText: string; source: string }>
    ).find((item) => item.rawText === 'gochujang');
    expect(unknown?.source).toMatch(/^(ai|fallback)$/);

    await completeCook(app, cookedId);
    await completeCook(app, cookedId);

    const cookedDetail = await app.inject({ method: 'GET', url: `/api/v1/recipes/${cookedId}` });
    expect(cookedDetail.json().data.cookCount).toBe(2);

    const latest = await app.inject({
      method: 'GET',
      url: '/api/v1/recipes?sort=latest&pageSize=10',
    });
    expect(latest.statusCode).toBe(200);
    const latestIds = (latest.json().data as Array<{ id: string }>).map((item) => item.id);
    expect(latestIds[0]).toBe(cookedId);

    const engagement = await app.inject({
      method: 'GET',
      url: '/api/v1/recipes?sort=engagement&pageSize=10',
    });
    expect(engagement.statusCode).toBe(200);
    const ranked = engagement.json().data as Array<{
      id: string;
      isFavorite: boolean;
      cookCount: number;
    }>;
    expect(ranked.map((item) => item.id)).toEqual([favoriteId, cookedId]);
    expect(ranked[0]).toMatchObject({ id: favoriteId, isFavorite: true });
    expect(ranked[1]).toMatchObject({ id: cookedId, cookCount: 2, isFavorite: false });

    const ops = await app.inject({ method: 'GET', url: '/api/v1/ops/summary' });
    expect(ops.statusCode).toBe(200);
    expect(ops.json().data).toMatchObject({
      profileScoped: true,
      revisions: { conflictsPersisted: false },
    });
    expect(ops.json().data.revisions.count).toBeGreaterThanOrEqual(3);
    expect(ops.json().data.pantry.items).toBeGreaterThan(0);
    expect(ops.json().data.queues.extractionByStatus.COMPLETED).toBeGreaterThanOrEqual(2);
    expect(ops.json().data.migrations.applied).toBeGreaterThan(0);
    expect(JSON.stringify(ops.json())).not.toMatch(
      /Weeknight pasta bowl|salt at the end|gochujang/i,
    );
  }, 20_000);
});
