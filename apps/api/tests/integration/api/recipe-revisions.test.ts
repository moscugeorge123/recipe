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
interface CategoryJson {
  id: string;
  slug: string;
}
interface RevisionJson {
  id: string;
}

describe.skipIf(!dbAvailable)('recipe revisions and categories', () => {
  const prisma = getTestPrisma();
  let app: FastifyInstance;

  beforeAll(() => resetDatabase(prisma));
  beforeEach(async () => {
    await resetDatabase(prisma);
    app = await buildTestApp({ container: createTestContainer({ enableMediaProcessing: false }) });
  });
  afterEach(() => app.close());
  afterAll(() => disconnectTestDatabase());

  async function importRecipe(url = 'https://example.com/fake-recipe') {
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

  it('creates a complete categorized immutable revision 0', async () => {
    const recipeId = await importRecipe();
    const response = await app.inject({ method: 'GET', url: `/api/v1/recipes/${recipeId}` });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      revisionNumber: 0,
      revisionSource: 'IMPORT',
      reviewState: expect.stringMatching(/NEEDS_REVIEW|READY/),
      categories: [expect.objectContaining({ slug: expect.any(String) })],
      nutritionStatus: expect.stringMatching(/^(PENDING|PROCESSING|COMPLETED|PARTIAL|FAILED)$/),
      cookCount: 0,
    });
    expect(response.json().data.ingredients[0]).toMatchObject({
      emoji: expect.any(String),
      colorToken: expect.any(String),
    });
    const revision = await prisma.recipeRevision.findFirstOrThrow({
      where: { userRecipe: { recipeId }, revisionNumber: 0 },
      include: { ingredients: true, steps: true, categories: true },
    });
    expect(revision.ingredients).not.toHaveLength(0);
    expect(revision.steps).not.toHaveLength(0);
    expect(revision.categories).not.toHaveLength(0);
  });

  it('appends complete snapshots, rejects stale drafts, and never mutates base rows', async () => {
    const recipeId = await importRecipe();
    const before = await prisma.recipe.findUniqueOrThrow({
      where: { id: recipeId },
      include: { ingredients: true, steps: true },
    });
    const detail = (
      await app.inject({
        method: 'GET',
        url: `/api/v1/recipes/${recipeId}`,
      })
    ).json<{ data: { ingredients: IngredientJson[]; steps: StepJson[] } }>().data;
    const categories = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/categories',
      })
    ).json<{ data: CategoryJson[] }>().data;
    const payload = {
      expectedRevisionNumber: 0,
      title: 'My corrected pasta',
      description: 'Corrected before saving',
      servings: 3,
      prepTimeMinutes: 8,
      cookTimeMinutes: 17,
      totalTimeMinutes: 25,
      calories: 390,
      cuisine: 'Italian',
      categoryIds: [categories[1]!.id],
      ingredients: detail.ingredients.map((item, index) => ({
        name: item.name,
        canonicalName: item.canonicalName,
        quantity: item.quantity,
        unit: item.unit,
        preparation: item.preparation,
        optional: item.optional,
        emoji: index === 0 ? '🍝' : item.emoji,
        colorToken: item.colorToken,
        category: item.category,
        sortOrder: index,
      })),
      steps: detail.steps.map((item, index) => ({
        stepOrder: index + 1,
        instruction: item.instruction,
        durationMinutes: item.durationMinutes,
        temperature: item.temperature,
        stage: item.stage,
      })),
    };
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/v1/recipes/${recipeId}`,
      payload,
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().data).toMatchObject({
      title: 'My corrected pasta',
      revisionNumber: 1,
      reviewState: 'READY',
      source: expect.objectContaining({
        originalUrl: expect.stringContaining('fake-recipe'),
      }),
    });
    const stale = await app.inject({
      method: 'PATCH',
      url: `/api/v1/recipes/${recipeId}`,
      payload,
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error.code).toBe('RECIPE_REVISION_CONFLICT');
    const after = await prisma.recipe.findUniqueOrThrow({
      where: { id: recipeId },
      include: { ingredients: true, steps: true },
    });
    expect(after).toEqual(before);
  });

  it('lists readable history and restores original as a new head', async () => {
    const recipeId = await importRecipe();
    const original = (
      await app.inject({
        method: 'GET',
        url: `/api/v1/recipes/${recipeId}`,
      })
    ).json<{ data: { title: string } }>().data;
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/v1/recipes/${recipeId}`,
      payload: { expectedRevisionNumber: 0, title: 'Temporary title' },
    });
    expect(patched.statusCode).toBe(200);
    const history = await app.inject({
      method: 'GET',
      url: `/api/v1/recipes/${recipeId}/revisions`,
    });
    expect(history.json().data).toEqual([
      expect.objectContaining({
        revisionNumber: 1,
        changes: expect.arrayContaining(['Renamed to “Temporary title”']),
      }),
      expect.objectContaining({ revisionNumber: 0, isOriginal: true }),
    ]);
    const originalRevision = history.json<{ data: RevisionJson[] }>().data[1]!;
    const originalDetail = await app.inject({
      method: 'GET',
      url: `/api/v1/recipes/${recipeId}/revisions/${originalRevision.id}`,
    });
    expect(originalDetail.json().data.title).toBe(original.title);
    const restored = await app.inject({
      method: 'POST',
      url: `/api/v1/recipes/${recipeId}/revisions/${originalRevision.id}/restore`,
      payload: { expectedRevisionNumber: 1 },
    });
    expect(restored.json().data).toMatchObject({
      title: original.title,
      revisionNumber: 2,
      revisionSource: 'RESTORE',
    });
  });

  it('keeps original recipe and source metadata unchanged on force refresh', async () => {
    const recipeId = await importRecipe();
    const before = await prisma.recipe.findUniqueOrThrow({
      where: { id: recipeId },
      include: { recipeSource: true, ingredients: true, steps: true },
    });
    await importRecipe('https://example.com/fake-recipe?force=separate');
    const refreshed = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/extract',
      payload: { url: 'https://example.com/fake-recipe', forceRefresh: true },
    });
    expect(refreshed.statusCode).toBe(202);
    const after = await prisma.recipe.findUniqueOrThrow({
      where: { id: recipeId },
      include: { recipeSource: true, ingredients: true, steps: true },
    });
    expect(after).toEqual(before);
    expect(
      await prisma.recipeRevision.count({
        where: { userRecipe: { recipeId } },
      }),
    ).toBe(1);
  });

  it('scopes categories, preserves stable default slugs, and deletes no recipes', async () => {
    const recipeId = await importRecipe();
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/categories',
      payload: { name: 'Family favourites' },
    });
    expect(created.statusCode).toBe(201);
    const categoryId = created.json().data.id as string;
    const renamed = await app.inject({
      method: 'PATCH',
      url: `/api/v1/categories/${categoryId}`,
      payload: { name: 'Weeknight favourites' },
    });
    expect(renamed.json().data.slug).toBe('family-favourites');
    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/v1/categories/${categoryId}`,
    });
    expect(deleted.statusCode).toBe(200);
    expect(await prisma.recipe.count({ where: { id: recipeId } })).toBe(1);

    const defaults = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/categories',
      })
    ).json<{ data: Array<CategoryJson & { isDefault: boolean }> }>().data;
    const breakfast = defaults.find((item: { slug: string }) => item.slug === 'breakfast');
    expect(breakfast).toBeDefined();
    const protectedDelete = await app.inject({
      method: 'DELETE',
      url: `/api/v1/categories/${breakfast!.id}`,
    });
    expect(protectedDelete.statusCode).toBe(400);

    const otherUser = await prisma.user.create({ data: { profileKey: 'other' } });
    const foreign = await prisma.category.create({
      data: { userId: otherUser.id, slug: 'private', name: 'Private' },
    });
    const crossProfile = await app.inject({
      method: 'PATCH',
      url: `/api/v1/recipes/${recipeId}`,
      payload: { expectedRevisionNumber: 0, categoryIds: [foreign.id] },
    });
    expect(crossProfile.statusCode).toBe(400);
  });

  it('hides recipes that the current profile does not own', async () => {
    const source = await prisma.recipeSource.create({
      data: {
        sourceType: 'GENERIC_WEB',
        originalUrl: 'https://example.com/private-recipe',
        normalizedUrl: 'https://example.com/private-recipe',
        urlHash: 'private-recipe-hash',
      },
    });
    const recipe = await prisma.recipe.create({
      data: { title: 'Private stew', recipeSourceId: source.id },
    });
    const otherUser = await prisma.user.create({ data: { profileKey: 'owner-elsewhere' } });
    const link = await prisma.userRecipe.create({
      data: { userId: otherUser.id, recipeId: recipe.id },
    });
    await prisma.recipeRevision.create({
      data: {
        userRecipeId: link.id,
        authorUserId: otherUser.id,
        revisionNumber: 0,
        source: 'IMPORT',
        title: 'Private stew',
      },
    });

    const fetched = await app.inject({ method: 'GET', url: `/api/v1/recipes/${recipe.id}` });
    expect(fetched.statusCode).toBe(404);
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/v1/recipes/${recipe.id}`,
      payload: { expectedRevisionNumber: 0, title: 'Hijacked' },
    });
    expect(patched.statusCode).toBe(404);
    const history = await app.inject({
      method: 'GET',
      url: `/api/v1/recipes/${recipe.id}/revisions`,
    });
    expect(history.statusCode).toBe(404);
    const listed = await app.inject({ method: 'GET', url: '/api/v1/recipes?page=1&pageSize=50' });
    const listedIds = listed.json<{ data: Array<{ id: string }> }>().data.map((item) => item.id);
    expect(listedIds).not.toContain(recipe.id);
  });
});
