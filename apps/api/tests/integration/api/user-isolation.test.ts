import { DEFAULT_CATEGORIES } from '@recipe/contracts';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { ProfileResolver } from '../../../src/modules/profiles/domain/profile.js';
import { createTestContainer } from '../../../src/shared/di/container.js';
import { buildTestApp } from '../../helpers/build-test-app.js';
import {
  disconnectTestDatabase,
  getTestPrisma,
  isDatabaseAvailable,
  resetDatabase,
} from '../../helpers/database.js';

const dbAvailable = await isDatabaseAvailable();

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const FAKE_URL = 'https://example.com/fake-recipe';
const API = '/api/v1';

/** Resolves the caller from `Authorization: <userId>`; no token verification involved. */
const headerResolver: ProfileResolver = {
  async resolve({ authorization }) {
    if (!authorization) throw new Error('missing test authorization header');
    return { userId: authorization, mode: 'authenticated' };
  },
};

function as(userId: string): { authorization: string } {
  return { authorization: userId };
}

describe.skipIf(!dbAvailable)('per-user data isolation', () => {
  let app: FastifyInstance;
  const prisma = getTestPrisma();

  async function seedUser(id: string, email: string): Promise<void> {
    await prisma.user.create({ data: { id, email, displayName: email } });
    await prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((category) => ({ userId: id, ...category })),
    });
  }

  async function importRecipe(
    userId: string,
    url = FAKE_URL,
  ): Promise<{ jobId: string; recipeId: string; statusCode: number; deduplicated: boolean }> {
    const created = await app.inject({
      method: 'POST',
      url: `${API}/recipes/extract`,
      headers: as(userId),
      payload: { url },
    });
    const data = created.json().data as {
      jobId: string;
      recipeId?: string;
      deduplicated?: boolean;
    };
    let recipeId = data.recipeId;
    if (!recipeId) {
      const status = await app.inject({
        method: 'GET',
        url: `${API}/recipes/extract/jobs/${data.jobId}`,
        headers: as(userId),
      });
      recipeId = status.json().data.recipeId as string;
    }
    return {
      jobId: data.jobId,
      recipeId,
      statusCode: created.statusCode,
      deduplicated: data.deduplicated === true,
    };
  }

  async function listRecipeIds(userId: string): Promise<string[]> {
    const response = await app.inject({
      method: 'GET',
      url: `${API}/recipes`,
      headers: as(userId),
    });
    expect(response.statusCode).toBe(200);
    return (response.json().data as Array<{ id: string }>).map((recipe) => recipe.id);
  }

  beforeAll(async () => {
    await resetDatabase(prisma, { bootstrapDefaults: false });
  });

  beforeEach(async () => {
    await resetDatabase(prisma, { bootstrapDefaults: false });
    await seedUser(USER_A, 'a@example.com');
    await seedUser(USER_B, 'b@example.com');
    const container = createTestContainer({
      enableMediaProcessing: false,
      profileResolver: headerResolver,
    });
    app = await buildTestApp({ container });
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it('records the requesting user on the job and owns the new recipe', async () => {
    const { jobId, recipeId } = await importRecipe(USER_A);

    const job = await prisma.extractionJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.requestedByUserId).toBe(USER_A);
    await expect(
      prisma.userRecipe.count({ where: { userId: USER_A, recipeId } }),
    ).resolves.toBe(1);
    await expect(
      prisma.userRecipe.count({ where: { userId: USER_B, recipeId } }),
    ).resolves.toBe(0);

    expect(await listRecipeIds(USER_A)).toEqual([recipeId]);
    expect(await listRecipeIds(USER_B)).toEqual([]);
  });

  describe('extraction jobs', () => {
    it('hides job status from other users', async () => {
      const { jobId } = await importRecipe(USER_A);

      const own = await app.inject({
        method: 'GET',
        url: `${API}/recipes/extract/jobs/${jobId}`,
        headers: as(USER_A),
      });
      expect(own.statusCode).toBe(200);

      const other = await app.inject({
        method: 'GET',
        url: `${API}/recipes/extract/jobs/${jobId}`,
        headers: as(USER_B),
      });
      expect(other.statusCode).toBe(404);
    });

    it('does not let another user cancel a job', async () => {
      const source = await prisma.recipeSource.create({
        data: {
          sourceType: 'GENERIC_WEB',
          originalUrl: 'https://example.com/queued',
          normalizedUrl: 'https://example.com/queued',
          urlHash: 'queued-job-hash',
        },
      });
      const job = await prisma.extractionJob.create({
        data: { recipeSourceId: source.id, requestedByUserId: USER_A, status: 'QUEUED' },
      });

      const denied = await app.inject({
        method: 'POST',
        url: `${API}/recipes/extract/jobs/${job.id}/cancel`,
        headers: as(USER_B),
      });
      expect(denied.statusCode).toBe(404);
      await expect(
        prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } }),
      ).resolves.toMatchObject({ status: 'QUEUED' });

      const allowed = await app.inject({
        method: 'POST',
        url: `${API}/recipes/extract/jobs/${job.id}/cancel`,
        headers: as(USER_A),
      });
      expect(allowed.statusCode).toBe(200);
      await expect(
        prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } }),
      ).resolves.toMatchObject({ status: 'CANCELLED' });
    });

    it('links an already-imported recipe to a second user on the dedup path', async () => {
      const first = await importRecipe(USER_A);
      expect(await listRecipeIds(USER_B)).toEqual([]);

      const second = await importRecipe(USER_B);
      expect(second.deduplicated).toBe(true);
      expect(second.statusCode).toBe(200);
      expect(second.recipeId).toBe(first.recipeId);

      expect(await listRecipeIds(USER_B)).toEqual([first.recipeId]);

      const link = await prisma.userRecipe.findUniqueOrThrow({
        where: { userId_recipeId: { userId: USER_B, recipeId: first.recipeId } },
        include: { revisions: true, categoryLinks: true },
      });
      expect(link.revisions.map((revision) => revision.revisionNumber)).toEqual([0]);
      expect(link.categoryLinks.length).toBeGreaterThan(0);

      // The returned job id is the original job; it is visible to anyone who holds its recipe.
      const status = await app.inject({
        method: 'GET',
        url: `${API}/recipes/extract/jobs/${second.jobId}`,
        headers: as(USER_B),
      });
      expect(status.statusCode).toBe(200);
    });

    it('is idempotent when the same user imports a known recipe again', async () => {
      const first = await importRecipe(USER_A);
      await importRecipe(USER_B);
      await importRecipe(USER_B);

      await expect(
        prisma.userRecipe.count({ where: { userId: USER_B, recipeId: first.recipeId } }),
      ).resolves.toBe(1);
      await expect(
        prisma.recipeRevision.count({ where: { userRecipe: { userId: USER_B } } }),
      ).resolves.toBe(1);
    });

    it('attributes forced re-extraction to the new requester', async () => {
      const first = await importRecipe(USER_A);

      const refreshed = await app.inject({
        method: 'POST',
        url: `${API}/recipes/extract`,
        headers: as(USER_B),
        payload: { url: FAKE_URL, forceRefresh: true },
      });
      expect(refreshed.statusCode).toBe(202);

      const job = await prisma.extractionJob.findUniqueOrThrow({
        where: { id: refreshed.json().data.jobId as string },
      });
      expect(job.requestedByUserId).toBe(USER_B);
      // The pipeline reuses the shared recipe and gives user B a copy of it.
      expect(await listRecipeIds(USER_B)).toEqual([first.recipeId]);
    });
  });

  describe('cook sessions', () => {
    it('refuses to start a session for a recipe the user does not have', async () => {
      const { recipeId } = await importRecipe(USER_A);

      const response = await app.inject({
        method: 'POST',
        url: `${API}/cook-sessions`,
        headers: as(USER_B),
        payload: { recipeId },
      });
      expect(response.statusCode).toBe(404);
      await expect(prisma.cookSession.count({ where: { userId: USER_B } })).resolves.toBe(0);
    });

    it('scopes list, read, update and delete to the owner', async () => {
      const { recipeId } = await importRecipe(USER_A);
      await importRecipe(USER_B);

      const created = await app.inject({
        method: 'POST',
        url: `${API}/cook-sessions`,
        headers: as(USER_A),
        payload: { recipeId },
      });
      expect(created.statusCode).toBe(201);
      const sessionId = created.json().data.id as string;
      await expect(
        prisma.cookSession.findUniqueOrThrow({ where: { id: sessionId } }),
      ).resolves.toMatchObject({ userId: USER_A });

      const listB = await app.inject({
        method: 'GET',
        url: `${API}/cook-sessions`,
        headers: as(USER_B),
      });
      expect(listB.json().data).toEqual([]);

      const listA = await app.inject({
        method: 'GET',
        url: `${API}/cook-sessions`,
        headers: as(USER_A),
      });
      expect(listA.json().data).toHaveLength(1);

      const get = await app.inject({
        method: 'GET',
        url: `${API}/cook-sessions/${sessionId}`,
        headers: as(USER_B),
      });
      expect(get.statusCode).toBe(404);

      const patch = await app.inject({
        method: 'PATCH',
        url: `${API}/cook-sessions/${sessionId}`,
        headers: as(USER_B),
        payload: { status: 'STOPPED' },
      });
      expect(patch.statusCode).toBe(404);

      const del = await app.inject({
        method: 'DELETE',
        url: `${API}/cook-sessions/${sessionId}`,
        headers: as(USER_B),
      });
      expect(del.statusCode).toBe(404);

      await expect(
        prisma.cookSession.findUniqueOrThrow({ where: { id: sessionId } }),
      ).resolves.toMatchObject({ status: 'IN_PROGRESS' });
    });

    it('lets two users cook the same recipe at the same time', async () => {
      const { recipeId } = await importRecipe(USER_A);
      await importRecipe(USER_B);

      for (const userId of [USER_A, USER_B]) {
        const response = await app.inject({
          method: 'POST',
          url: `${API}/cook-sessions`,
          headers: as(userId),
          payload: { recipeId },
        });
        expect(response.statusCode).toBe(201);
      }
      await expect(
        prisma.cookSession.count({ where: { recipeId, status: 'IN_PROGRESS' } }),
      ).resolves.toBe(2);
    });
  });

  describe('recipe delete', () => {
    it("keeps the other user's copy and the shared recipe", async () => {
      const { recipeId } = await importRecipe(USER_A);
      await importRecipe(USER_B);

      const deleted = await app.inject({
        method: 'DELETE',
        url: `${API}/recipes/${recipeId}`,
        headers: as(USER_A),
      });
      expect(deleted.statusCode).toBe(200);

      expect(await listRecipeIds(USER_A)).toEqual([]);
      expect(await listRecipeIds(USER_B)).toEqual([recipeId]);
      await expect(prisma.recipe.count({ where: { id: recipeId } })).resolves.toBe(1);

      const stillThere = await app.inject({
        method: 'GET',
        url: `${API}/recipes/${recipeId}`,
        headers: as(USER_B),
      });
      expect(stillThere.statusCode).toBe(200);
    });

    it('removes the shared recipe once the last owner deletes it', async () => {
      const { recipeId } = await importRecipe(USER_A);
      await importRecipe(USER_B);

      for (const userId of [USER_A, USER_B]) {
        const response = await app.inject({
          method: 'DELETE',
          url: `${API}/recipes/${recipeId}`,
          headers: as(userId),
        });
        expect(response.statusCode).toBe(200);
      }
      await expect(prisma.recipe.count({ where: { id: recipeId } })).resolves.toBe(0);
    });

    it('returns 404 when the user has no copy and leaves the owner untouched', async () => {
      const { recipeId } = await importRecipe(USER_A);

      const response = await app.inject({
        method: 'DELETE',
        url: `${API}/recipes/${recipeId}`,
        headers: as(USER_B),
      });
      expect(response.statusCode).toBe(404);
      expect(await listRecipeIds(USER_A)).toEqual([recipeId]);
    });

    it("deletes the caller's cook sessions for the recipe but not the other user's", async () => {
      const { recipeId } = await importRecipe(USER_A);
      await importRecipe(USER_B);
      for (const userId of [USER_A, USER_B]) {
        await app.inject({
          method: 'POST',
          url: `${API}/cook-sessions`,
          headers: as(userId),
          payload: { recipeId },
        });
      }

      await app.inject({
        method: 'DELETE',
        url: `${API}/recipes/${recipeId}`,
        headers: as(USER_A),
      });

      await expect(prisma.cookSession.count({ where: { userId: USER_A } })).resolves.toBe(0);
      await expect(prisma.cookSession.count({ where: { userId: USER_B } })).resolves.toBe(1);
    });
  });
});
