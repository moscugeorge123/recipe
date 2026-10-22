import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LocalStorageProvider } from '../../../src/infrastructure/storage/local/local-storage-provider.js';
import type { QueueProvider } from '../../../src/infrastructure/queues/bullmq/queue-provider.js';
import { createTestContainer } from '../../../src/shared/di/container.js';
import { buildTestApp } from '../../helpers/build-test-app.js';
import {
  disconnectTestDatabase,
  getTestPrisma,
  isDatabaseAvailable,
  resetDatabase,
} from '../../helpers/database.js';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const b64 = (data: Buffer): string => data.toString('base64');

describe('POST /api/v1/recipes/extract/photos validation', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });
  afterEach(async () => {
    await app.close();
  });

  it('rejects a file that is not an image even if it claims to be one', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/extract/photos',
      payload: { images: [{ data: b64(Buffer.from('<html>not an image</html>')) }] },
    });

    expect(response.statusCode).toBe(415);
    expect(response.json().error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('rejects an empty list and more than six pages', async () => {
    const none = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/extract/photos',
      payload: { images: [] },
    });
    const many = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/extract/photos',
      payload: { images: Array.from({ length: 7 }, () => ({ data: b64(JPEG) })) },
    });

    expect(none.statusCode).toBe(400);
    expect(many.statusCode).toBe(400);
  });

  it('does not accept an internal photo:// source through the link endpoint', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/extract',
      payload: { url: 'photo://6f1c7f0e-8f5b-4c53-a7aa-5d8f5d1c2b11?pages=jpg' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('previews a Facebook link as a Facebook source without scraping the login wall', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/preview',
      payload: { url: 'https://www.facebook.com/reel/1234567890' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ sourceType: 'FACEBOOK', title: null });
  });
});

const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)('POST /api/v1/recipes/extract/photos', () => {
  const prisma = getTestPrisma();
  let app: FastifyInstance;
  let storageDir: string;
  const enqueued: unknown[] = [];

  beforeEach(async () => {
    await resetDatabase(prisma);
    enqueued.length = 0;
    storageDir = await mkdtemp(path.join(tmpdir(), 'photo-import-'));
    app = await buildTestApp({
      container: createTestContainer({
        enableMediaProcessing: false,
        storage: new LocalStorageProvider(storageDir),
        queue: {
          enqueue: (_name, payload) => {
            enqueued.push(payload);
            return Promise.resolve();
          },
          registerProcessor: () => undefined,
          close: () => Promise.resolve(),
        } satisfies QueueProvider,
      }),
    });
  });
  afterEach(async () => {
    await app.close();
    await rm(storageDir, { recursive: true, force: true });
  });
  afterAll(() => disconnectTestDatabase());

  it('stores the pages and queues a job on a PHOTO source', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/extract/photos',
      payload: {
        images: [{ data: b64(JPEG) }, { data: `data:image/jpeg;base64,${b64(JPEG)}` }],
        outputLanguage: 'en',
      },
    });

    expect(response.statusCode).toBe(202);
    const { jobId, status } = response.json().data as { jobId: string; status: string };
    expect(status).toBe('queued');
    expect(enqueued).toEqual([{ jobId }]);

    const job = await prisma.extractionJob.findUniqueOrThrow({
      where: { id: jobId },
      include: { recipeSource: true },
    });
    expect(job.recipeSource.sourceType).toBe('PHOTO');
    expect(job.recipeSource.originalUrl).toMatch(/^photo:\/\/.+\?pages=jpg,jpg$/);

    const [importDir] = await readdir(path.join(storageDir, 'photo-imports'));
    expect(await readdir(path.join(storageDir, 'photo-imports', importDir as string))).toEqual([
      '01.jpg',
      '02.jpg',
    ]);

    const polled = await app.inject({ method: 'GET', url: `/api/v1/recipes/extract/jobs/${jobId}` });
    expect(polled.statusCode).toBe(200);
    expect(polled.json().data.status).toBe('QUEUED');
  });
});
