import type { ExtractionJob, RecipeSource } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/infrastructure/security/ssrf-guard.js', () => ({
  assertSafeUrl: vi.fn(() => Promise.resolve(new URL('https://example.com'))),
}));

import { ExtractionJobService } from '../../../../src/modules/jobs/application/extraction-job.service.js';
import type { IExtractionJobRepository } from '../../../../src/modules/jobs/repository/extraction-job.repository.js';
import type {
  CreateRecipeSourceInput,
  IRecipeSourceRepository,
} from '../../../../src/modules/recipes/repository/recipe-source.repository.js';
import { hashUrl, legacyNormalizeUrl } from '../../../../src/shared/utils/url.js';

const ACTIVE = new Set(['QUEUED', 'ACQUIRING_CONTENT', 'EXTRACTING_RECIPE']);
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function makeFakes() {
  const sources: RecipeSource[] = [];
  const jobs: ExtractionJob[] = [];

  const sourceRepo = {
    create: vi.fn(),
    findById: vi.fn(),
    updateMetadata: vi.fn(),
    findByUrlHash: vi.fn(async (hash: string) => {
      await tick();
      return sources.find((s) => s.urlHash === hash) ?? null;
    }),
    findOrCreate: vi.fn(async (input: CreateRecipeSourceInput) => {
      await tick();
      const existing = sources.find((s) => s.urlHash === input.urlHash);
      if (existing) return existing;
      const row = { id: "src-" + String(sources.length + 1), ...input, createdAt: new Date() } as RecipeSource;
      sources.push(row);
      return row;
    }),
  } satisfies IRecipeSourceRepository;

  const jobRepo = {
    create: vi.fn(async (input: { recipeSourceId: string; requestedByUserId?: string | null }) => {
      await tick();
      const row = {
        id: "job-" + String(jobs.length + 1),
        recipeSourceId: input.recipeSourceId,
        requestedByUserId: input.requestedByUserId ?? null,
        status: 'QUEUED',
        recipeId: null,
        createdAt: new Date(),
      } as unknown as ExtractionJob;
      jobs.push(row);
      return row;
    }),
    findById: vi.fn(),
    update: vi.fn(),
    findLatestCompletedBySourceId: vi.fn(async (id: string) => {
      await tick();
      return jobs.find((j) => j.recipeSourceId === id && j.status === 'COMPLETED' && j.recipeId) ?? null;
    }),
    findActiveBySourceId: vi.fn(async (id: string, userId: string, since: Date) => {
      await tick();
      return (
        jobs.find(
          (j) =>
            j.recipeSourceId === id &&
            j.requestedByUserId === userId &&
            ACTIVE.has(j.status) &&
            j.createdAt >= since,
        ) ?? null
      );
    }),
    clearRecipeIdExcept: vi.fn(),
    linkRecipeToUser: vi.fn(async () => undefined),
    userHasRecipe: vi.fn(),
  } satisfies IExtractionJobRepository;

  const queue = { enqueue: vi.fn(async () => undefined) };
  const registry = { detectSourceType: vi.fn(() => 'GENERIC_WEB') };
  const uploads = new Map<string, Buffer>();
  const storage = {
    upload: vi.fn(async (key: string, data: Buffer) => {
      uploads.set(key, data);
      return { key, sizeBytes: data.byteLength, contentType: 'image/jpeg' };
    }),
  };
  const service = new ExtractionJobService(
    jobRepo,
    sourceRepo,
    registry as never,
    queue as never,
    undefined,
    storage as never,
  );
  return { service, sources, jobs, sourceRepo, jobRepo, queue, uploads };
}

describe('ExtractionJobService.createJob', () => {
  let f: ReturnType<typeof makeFakes>;
  beforeEach(() => {
    f = makeFakes();
  });

  it('returns the running job instead of creating a second one', async () => {
    const first = await f.service.createJob('u1', { url: 'https://example.com/r' });
    const second = await f.service.createJob('u1', { url: 'https://www.example.com/r?utm_source=x' });

    expect(second.jobId).toBe(first.jobId);
    expect(second.status).toBe('queued');
    expect(second.deduplicated).toBe(false);
    expect(f.jobs).toHaveLength(1);
    expect(f.queue.enqueue).toHaveBeenCalledTimes(1);
  });

  it('shares one source and one job between parallel requests for the same link', async () => {
    const [a, b, c] = await Promise.all([
      f.service.createJob('u1', { url: 'https://youtu.be/dQw4w9WgXcQ?si=one' }),
      f.service.createJob('u1', { url: 'https://youtu.be/dQw4w9WgXcQ?si=two' }),
      f.service.createJob('u1', { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
    ]);

    expect(f.sources).toHaveLength(1);
    expect(f.jobs).toHaveLength(1);
    expect(new Set([a.jobId, b.jobId, c.jobId]).size).toBe(1);
  });

  it('does not join another account’s job', async () => {
    const a = await f.service.createJob('u1', { url: 'https://example.com/r' });
    const b = await f.service.createJob('u2', { url: 'https://example.com/r' });
    expect(b.jobId).not.toBe(a.jobId);
  });

  it('starts a new job once the running one has failed', async () => {
    const a = await f.service.createJob('u1', { url: 'https://example.com/r' });
    f.jobs[0]!.status = 'FAILED';
    const b = await f.service.createJob('u1', { url: 'https://example.com/r' });
    expect(b.jobId).not.toBe(a.jobId);
  });

  it('ignores a running job that is long abandoned', async () => {
    const a = await f.service.createJob('u1', { url: 'https://example.com/r' });
    f.jobs[0]!.createdAt = new Date(Date.now() - 60 * 60 * 1000);
    const b = await f.service.createJob('u1', { url: 'https://example.com/r' });
    expect(b.jobId).not.toBe(a.jobId);
  });

  it('resolves a completed recipe by a link that differs only by tracking parameters', async () => {
    const a = await f.service.createJob('u1', { url: 'https://youtu.be/dQw4w9WgXcQ?si=one' });
    f.jobs[0]!.status = 'COMPLETED';
    (f.jobs[0] as { recipeId: string | null }).recipeId = 'recipe-1';

    const b = await f.service.createJob('u1', { url: 'https://m.youtube.com/watch?v=dQw4w9WgXcQ' });
    expect(b).toMatchObject({ jobId: a.jobId, status: 'completed', recipeId: 'recipe-1', deduplicated: true });
  });

  it('still finds a source saved under the old normalisation', async () => {
    const url = 'https://www.example.com/old-recipe?utm_source=x';
    const legacy = legacyNormalizeUrl(url);
    f.sources.push({
      id: 'src-old',
      sourceType: 'GENERIC_WEB',
      originalUrl: url,
      normalizedUrl: legacy,
      urlHash: hashUrl(legacy),
      metadata: {},
      createdAt: new Date(),
    });
    f.jobs.push({
      id: 'job-old',
      recipeSourceId: 'src-old',
      requestedByUserId: 'u1',
      status: 'COMPLETED',
      recipeId: 'recipe-old',
      createdAt: new Date(),
    } as unknown as ExtractionJob);

    const res = await f.service.createJob('u1', { url });
    expect(res).toMatchObject({ jobId: 'job-old', recipeId: 'recipe-old', deduplicated: true });
    expect(f.sources).toHaveLength(1);
  });
});

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);

describe('ExtractionJobService.createPhotoJob', () => {
  let f: ReturnType<typeof makeFakes>;
  beforeEach(() => {
    f = makeFakes();
  });

  it('stores the pages, creates a PHOTO source and queues a job', async () => {
    const res = await f.service.createPhotoJob('u1', { images: [JPEG, PNG], outputLanguage: 'ro' });

    expect(res).toEqual({ jobId: 'job-1', status: 'queued' });
    expect(f.sources).toHaveLength(1);
    expect(f.sources[0]).toMatchObject({ sourceType: 'PHOTO' });
    expect(f.sources[0]?.originalUrl).toMatch(/^photo:\/\/[0-9a-f-]{36}\?pages=jpg,png$/);
    expect([...f.uploads.keys()].map((key) => key.replace(/[0-9a-f-]{36}/, 'ID'))).toEqual([
      'photo-imports/ID/01.jpg',
      'photo-imports/ID/02.png',
    ]);
    expect(f.jobs[0]).toMatchObject({ requestedByUserId: 'u1' });
    expect(f.jobRepo.create).toHaveBeenCalledWith(expect.objectContaining({ outputLanguage: 'ro' }));
    expect(f.queue.enqueue).toHaveBeenCalledWith('extract', { jobId: 'job-1' });
  });

  it('never de-duplicates: the same photo twice is two imports', async () => {
    const a = await f.service.createPhotoJob('u1', { images: [JPEG] });
    const b = await f.service.createPhotoJob('u1', { images: [JPEG] });
    expect(b.jobId).not.toBe(a.jobId);
    expect(f.sources).toHaveLength(2);
  });

  it('rejects files that are not JPEG, PNG or WebP, whatever the client says', async () => {
    await expect(
      f.service.createPhotoJob('u1', { images: [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')] }),
    ).rejects.toMatchObject({ statusCode: 415 });
    expect(f.uploads.size).toBe(0);
    expect(f.queue.enqueue).not.toHaveBeenCalled();
  });

  it('rejects an empty upload, too many pages and oversized photos', async () => {
    await expect(f.service.createPhotoJob('u1', { images: [] })).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      f.service.createPhotoJob('u1', { images: Array.from({ length: 7 }, () => JPEG) }),
    ).rejects.toMatchObject({ statusCode: 400 });
    const huge = Buffer.concat([JPEG, Buffer.alloc(10 * 1024 * 1024)]);
    await expect(f.service.createPhotoJob('u1', { images: [huge] })).rejects.toMatchObject({
      statusCode: 413,
    });
    expect(f.uploads.size).toBe(0);
  });

  it('is unavailable without storage', async () => {
    const service = new ExtractionJobService(f.jobRepo, f.sourceRepo, {} as never, f.queue as never);
    await expect(service.createPhotoJob('u1', { images: [JPEG] })).rejects.toMatchObject({ statusCode: 503 });
  });
});
