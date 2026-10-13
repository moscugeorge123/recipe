import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LocalStorageProvider } from '../../../src/infrastructure/storage/local/local-storage-provider.js';
import { createTestContainer } from '../../../src/shared/di/container.js';
import { buildTestApp } from '../../helpers/build-test-app.js';
import {
  disconnectTestDatabase,
  getTestPrisma,
  isDatabaseAvailable,
  resetDatabase,
} from '../../helpers/database.js';

const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)('recipe source video', () => {
  const prisma = getTestPrisma();
  let app: FastifyInstance;
  let storageDir: string;
  let storage: LocalStorageProvider;

  beforeEach(async () => {
    await resetDatabase(prisma);
    storageDir = await mkdtemp(path.join(tmpdir(), 'recipe-video-'));
    storage = new LocalStorageProvider(storageDir);
    app = await buildTestApp({
      container: createTestContainer({ enableMediaProcessing: false, storage }),
    });
  });
  afterEach(async () => {
    await app.close();
    await rm(storageDir, { recursive: true, force: true });
  });
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

  async function attachVideo(recipeId: string, bytes: Buffer): Promise<void> {
    await storage.upload('jobs/test/video.mp4', bytes, { contentType: 'video/mp4' });
    const recipe = await prisma.recipe.findUniqueOrThrow({ where: { id: recipeId } });
    await prisma.recipeSource.update({
      where: { id: recipe.recipeSourceId },
      data: {
        metadata: {
          video: { storageKey: 'jobs/test/video.mp4', mimeType: 'video/mp4', durationSeconds: 42 },
        },
      },
    });
  }

  it('is absent, and 404s, for recipes imported without a video', async () => {
    const recipeId = await importRecipe();
    const detail = await app.inject({ method: 'GET', url: `/api/v1/recipes/${recipeId}` });
    expect(detail.json().data.source.video).toBeNull();

    const video = await app.inject({ method: 'GET', url: `/api/v1/recipes/${recipeId}/video` });
    expect(video.statusCode).toBe(404);
  });

  it('streams the stored video with byte ranges', async () => {
    const recipeId = await importRecipe();
    await attachVideo(recipeId, Buffer.from('0123456789'));

    const detail = await app.inject({ method: 'GET', url: `/api/v1/recipes/${recipeId}` });
    expect(detail.json().data.source.video).toEqual({
      path: `/recipes/${recipeId}/video`,
      mimeType: 'video/mp4',
      durationSeconds: 42,
    });

    const whole = await app.inject({ method: 'GET', url: `/api/v1/recipes/${recipeId}/video` });
    expect(whole.statusCode).toBe(200);
    expect(whole.headers['accept-ranges']).toBe('bytes');
    expect(whole.body).toBe('0123456789');

    const part = await app.inject({
      method: 'GET',
      url: `/api/v1/recipes/${recipeId}/video`,
      headers: { range: 'bytes=2-5' },
    });
    expect(part.statusCode).toBe(206);
    expect(part.headers['content-range']).toBe('bytes 2-5/10');
    expect(part.headers['content-type']).toBe('video/mp4');
    expect(part.body).toBe('2345');

    const past = await app.inject({
      method: 'GET',
      url: `/api/v1/recipes/${recipeId}/video`,
      headers: { range: 'bytes=50-' },
    });
    expect(past.statusCode).toBe(416);
  });
});
