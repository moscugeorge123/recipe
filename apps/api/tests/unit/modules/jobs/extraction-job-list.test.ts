import type { ExtractionJob } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { ExtractionJobService } from '../../../../src/modules/jobs/application/extraction-job.service.js';
import type {
  ExtractionJobWithSource,
  IExtractionJobRepository,
} from '../../../../src/modules/jobs/repository/extraction-job.repository.js';
import { DEFAULT_PROFILE_ID } from '../../../../src/modules/profiles/domain/profile.js';

function job(overrides: Partial<ExtractionJobWithSource> = {}): ExtractionJobWithSource {
  return {
    id: 'job-1',
    recipeSourceId: 'src-1',
    recipeId: 'rec-1',
    requestedByUserId: 'user-1',
    status: 'COMPLETED',
    progress: 100,
    currentStage: null,
    sourceLanguage: null,
    outputLanguage: 'en',
    options: {},
    error: null,
    retryCount: 0,
    startedAt: null,
    completedAt: new Date('2026-01-02T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    recipeSource: { originalUrl: 'https://example.com/pasta' },
    recipe: { title: 'Pasta' },
    ...overrides,
  } satisfies ExtractionJob & Pick<ExtractionJobWithSource, 'recipeSource' | 'recipe'>;
}

function serviceWith(listByRequester: IExtractionJobRepository['listByRequester']) {
  const repo = { listByRequester } as unknown as IExtractionJobRepository;
  return new ExtractionJobService(repo, {} as never, {} as never, {} as never);
}

describe('ExtractionJobService.listJobs', () => {
  it('maps jobs to history rows with url, title and error', async () => {
    const list = vi.fn().mockResolvedValue([
      job(),
      job({
        id: 'job-2',
        status: 'FAILED',
        recipeId: null,
        recipe: null,
        error: { code: 'NOT_A_RECIPE' },
      }),
    ]);
    const rows = await serviceWith(list).listJobs('user-1', 20);

    expect(list).toHaveBeenCalledWith('user-1', 20, false);
    expect(rows).toEqual([
      expect.objectContaining({
        id: 'job-1',
        url: 'https://example.com/pasta',
        title: 'Pasta',
        recipeId: 'rec-1',
        status: 'COMPLETED',
      }),
      expect.objectContaining({
        id: 'job-2',
        title: null,
        recipeId: null,
        status: 'FAILED',
        error: { code: 'NOT_A_RECIPE' },
      }),
    ]);
  });

  it('includes pre-account jobs only for the default profile', async () => {
    const list = vi.fn().mockResolvedValue([]);
    await serviceWith(list).listJobs(DEFAULT_PROFILE_ID, 5);
    expect(list).toHaveBeenCalledWith(DEFAULT_PROFILE_ID, 5, true);
  });
});
