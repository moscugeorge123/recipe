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

async function completeCook(app: FastifyInstance, recipeId: string): Promise<string> {
  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/cook-sessions',
    payload: { recipeId },
  });
  const sessionId = created.json().data.id as string;
  await app.inject({
    method: 'PATCH',
    url: `/api/v1/cook-sessions/${sessionId}`,
    payload: { status: 'COMPLETED' },
  });
  return sessionId;
}

describe.skipIf(!dbAvailable)('recipe favorites, ratings, notes, and home ranking', () => {
  const prisma = getTestPrisma();
  let app: FastifyInstance;

  beforeAll(() => resetDatabase(prisma));
  beforeEach(async () => {
    await resetDatabase(prisma);
    app = await buildTestApp({ container: createTestContainer({ enableMediaProcessing: false }) });
  });
  afterEach(() => app.close());
  afterAll(() => disconnectTestDatabase());

  it('favorites are idempotent and honor expectedUpdatedAt', async () => {
    const recipeId = await importRecipe(app, 'https://example.com/fake-recipe');
    const first = await app.inject({
      method: 'PUT',
      url: `/api/v1/recipes/${recipeId}/favorite`,
      payload: {},
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().data).toMatchObject({ id: recipeId, isFavorite: true, cookCount: 0 });

    const again = await app.inject({
      method: 'PUT',
      url: `/api/v1/recipes/${recipeId}/favorite`,
      payload: {},
    });
    expect(again.statusCode).toBe(200);
    expect(again.json().data.isFavorite).toBe(true);
    expect(again.json().data.updatedAt).toBe(first.json().data.updatedAt);

    const stale = await app.inject({
      method: 'DELETE',
      url: `/api/v1/recipes/${recipeId}/favorite?expectedUpdatedAt=2020-01-01T00:00:00.000Z`,
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error.code).toBe('RECIPE_ENGAGEMENT_CONFLICT');

    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/v1/recipes/${recipeId}/favorite?expectedUpdatedAt=${encodeURIComponent(
        first.json().data.updatedAt as string,
      )}`,
    });
    expect(removed.statusCode).toBe(200);
    expect(removed.json().data.isFavorite).toBe(false);
  });

  it('review-state writes are idempotent and do not create revisions', async () => {
    const recipeId = await importRecipe(app, 'https://example.com/fake-recipe');
    const before = await prisma.recipeRevision.count({
      where: { userRecipe: { recipeId } },
    });
    const first = await app.inject({
      method: 'PUT',
      url: `/api/v1/recipes/${recipeId}/review-state`,
      payload: { reviewState: 'READY' },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().data).toMatchObject({
      id: recipeId,
      reviewState: 'READY',
    });

    const again = await app.inject({
      method: 'PUT',
      url: `/api/v1/recipes/${recipeId}/review-state`,
      payload: { reviewState: 'READY' },
    });
    expect(again.statusCode).toBe(200);
    expect(again.json().data.updatedAt).toBe(first.json().data.updatedAt);
    expect(await prisma.recipeRevision.count({ where: { userRecipe: { recipeId } } })).toBe(
      before,
    );

    const list = await app.inject({ method: 'GET', url: '/api/v1/recipes?pageSize=20' });
    const row = (list.json().data as { id: string; reviewState: string }[]).find(
      (item) => item.id === recipeId,
    );
    expect(row?.reviewState).toBe('READY');
  });

  it('sets and clears a profile rating separately from aggregates, rejecting out of bounds', async () => {
    const recipeId = await importRecipe(app, 'https://example.com/fake-recipe');
    const tooHigh = await app.inject({
      method: 'PUT',
      url: `/api/v1/recipes/${recipeId}/rating`,
      payload: { rating: 6 },
    });
    expect(tooHigh.statusCode).toBe(400);

    const tooLow = await app.inject({
      method: 'PUT',
      url: `/api/v1/recipes/${recipeId}/rating`,
      payload: { rating: 0 },
    });
    expect(tooLow.statusCode).toBe(400);

    const set = await app.inject({
      method: 'PUT',
      url: `/api/v1/recipes/${recipeId}/rating`,
      payload: { rating: 5 },
    });
    expect(set.statusCode).toBe(200);
    expect(set.json().data).toMatchObject({
      rating: 5,
      ratingAverage: 5,
      ratingCount: 1,
    });

    const detail = await app.inject({ method: 'GET', url: `/api/v1/recipes/${recipeId}` });
    expect(detail.json().data.rating).toBe(5);
    expect(detail.json().data.ratingAverage).toBe(5);
    expect(detail.json().data.ratingCount).toBe(1);

    const cleared = await app.inject({
      method: 'DELETE',
      url: `/api/v1/recipes/${recipeId}/rating`,
    });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json().data).toMatchObject({
      rating: null,
      ratingAverage: null,
      ratingCount: 0,
    });
  });

  it('notes are annotations that do not create revisions and stay on the owning recipe', async () => {
    const recipeId = await importRecipe(app, 'https://example.com/fake-recipe');
    const before = await prisma.recipeRevision.count({
      where: { userRecipe: { recipeId } },
    });
    const sessionId = await completeCook(app, recipeId);

    const created = await app.inject({
      method: 'POST',
      url: `/api/v1/recipes/${recipeId}/notes`,
      payload: { body: 'use a little less salt', cookSessionId: sessionId },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().data).toMatchObject({
      recipeId,
      body: 'use a little less salt',
      cookSessionId: sessionId,
    });
    expect(created.json().data.createdAt).toEqual(expect.any(String));
    expect(created.json().data.updatedAt).toEqual(expect.any(String));

    const after = await prisma.recipeRevision.count({
      where: { userRecipe: { recipeId } },
    });
    expect(after).toBe(before);

    const noteId = created.json().data.id as string;
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/v1/recipes/${recipeId}/notes/${noteId}`,
      payload: { body: 'parmesan already salts it' },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().data.body).toBe('parmesan already salts it');
    expect(await prisma.recipeRevision.count({ where: { userRecipe: { recipeId } } })).toBe(before);

    const listed = await app.inject({
      method: 'GET',
      url: `/api/v1/recipes/${recipeId}/notes`,
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().data).toHaveLength(1);

    const missing = await app.inject({
      method: 'DELETE',
      url: `/api/v1/recipes/${recipeId}/notes/33333333-3333-4333-8333-333333333333`,
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('RECIPE_NOTE_NOT_FOUND');

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/v1/recipes/${recipeId}/notes/${noteId}`,
    });
    expect(deleted.statusCode).toBe(200);
    expect(
      (await app.inject({ method: 'GET', url: `/api/v1/recipes/${recipeId}/notes` })).json().data,
    ).toEqual([]);
  });

  it('only COMPLETED cooks increment cookCount; STOPPED sessions stay history', async () => {
    const recipeId = await importRecipe(app, 'https://example.com/fake-recipe');
    const stopped = await app.inject({
      method: 'POST',
      url: '/api/v1/cook-sessions',
      payload: { recipeId },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/cook-sessions/${stopped.json().data.id as string}`,
      payload: { status: 'STOPPED' },
    });

    const afterStop = await app.inject({ method: 'GET', url: `/api/v1/recipes/${recipeId}` });
    expect(afterStop.json().data.cookCount).toBe(0);

    await completeCook(app, recipeId);
    await completeCook(app, recipeId);

    const afterComplete = await app.inject({ method: 'GET', url: `/api/v1/recipes/${recipeId}` });
    expect(afterComplete.json().data.cookCount).toBe(2);
  });

  it('lists with stable latest and engagement ordering and paginates', async () => {
    const first = await importRecipe(app, 'https://example.com/fake-recipe');
    const second = await importRecipe(app, 'https://example.com/fake-recipe-b');
    const third = await importRecipe(app, 'https://example.com/fake-recipe-c');

    await prisma.userRecipe.update({
      where: {
        userId_recipeId: {
          userId: '00000000-0000-4000-8000-000000000001',
          recipeId: first,
        },
      },
      data: { createdAt: new Date('2026-08-01T00:00:00.000Z') },
    });
    await prisma.userRecipe.update({
      where: {
        userId_recipeId: {
          userId: '00000000-0000-4000-8000-000000000001',
          recipeId: second,
        },
      },
      data: { createdAt: new Date('2026-08-02T00:00:00.000Z') },
    });
    await prisma.userRecipe.update({
      where: {
        userId_recipeId: {
          userId: '00000000-0000-4000-8000-000000000001',
          recipeId: third,
        },
      },
      data: { createdAt: new Date('2026-08-03T00:00:00.000Z') },
    });

    await app.inject({
      method: 'PATCH',
      url: `/api/v1/recipes/${first}`,
      payload: { title: 'Oldest renamed bowl' },
    });
    await app.inject({ method: 'PUT', url: `/api/v1/recipes/${second}/favorite`, payload: {} });
    await completeCook(app, third);
    await completeCook(app, third);

    const latest = await app.inject({
      method: 'GET',
      url: '/api/v1/recipes?sort=latest&pageSize=10',
    });
    expect(latest.statusCode).toBe(200);
    const latestIds = (latest.json().data as { id: string; title: string }[]).map((item) => item.id);
    expect(latestIds).toEqual([third, second, first]);
    expect(latest.json().data[2].title).toBe('Oldest renamed bowl');

    const engagement = await app.inject({
      method: 'GET',
      url: '/api/v1/recipes?sort=engagement&pageSize=10',
    });
    const ranked = engagement.json().data as {
      id: string;
      isFavorite: boolean;
      cookCount: number;
    }[];
    expect(ranked.map((item) => item.id)).toEqual([second, third, first]);
    expect(ranked[0]).toMatchObject({ id: second, isFavorite: true });
    expect(ranked[1]).toMatchObject({ id: third, cookCount: 2, isFavorite: false });
    expect(ranked[2]).toMatchObject({ id: first, cookCount: 0, isFavorite: false });

    const page1 = await app.inject({
      method: 'GET',
      url: '/api/v1/recipes?sort=engagement&page=1&pageSize=1',
    });
    const page2 = await app.inject({
      method: 'GET',
      url: '/api/v1/recipes?sort=engagement&page=2&pageSize=1',
    });
    const page3 = await app.inject({
      method: 'GET',
      url: '/api/v1/recipes?sort=engagement&page=3&pageSize=1',
    });
    expect(page1.json().data[0].id).toBe(second);
    expect(page2.json().data[0].id).toBe(third);
    expect(page3.json().data[0].id).toBe(first);
    expect(page1.json().meta).toMatchObject({ page: 1, pageSize: 1, total: 3, totalPages: 3 });
  });

  it('rejects a note cookSessionId that does not belong to the recipe', async () => {
    const recipeId = await importRecipe(app, 'https://example.com/fake-recipe');
    const other = await importRecipe(app, 'https://example.com/fake-recipe-b');
    const sessionId = await completeCook(app, other);

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/recipes/${recipeId}/notes`,
      payload: { body: 'wrong session', cookSessionId: sessionId },
    });
    expect(response.statusCode).toBe(400);
  });
});
