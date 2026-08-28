import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestContainer } from '../../../src/shared/di/container.js';
import {
  disconnectTestDatabase,
  getTestPrisma,
  isDatabaseAvailable,
  resetDatabase,
} from '../../helpers/database.js';

const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)('fake extraction pipeline', () => {
  const prisma = getTestPrisma();

  beforeAll(async () => {
    await resetDatabase(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it('runs the full pipeline and produces a completed job with recipe', async () => {
    const container = createTestContainer({
      enableMediaProcessing: false,
    });

    const result = await container.extractionJobService.createJob({
      url: 'https://example.com/fake-recipe',
      outputLanguage: 'en',
    });

    expect(result.status).toBe('queued');

    const status = await container.extractionJobService.getJobStatus(result.jobId);

    expect(status.status).toBe('COMPLETED');
    expect(status.progress).toBe(100);
    expect(status.recipeId).toBeTruthy();

    const stages = await container.repositories.extractionStage.listByJobId(result.jobId);
    expect(stages.every((s) => s.status === 'COMPLETED')).toBe(true);
    expect(stages).toHaveLength(8);

    const recipe = await container.repositories.recipe.findById(status.recipeId!);
    expect(recipe?.title).toBe('Fake pasta recipe');
  });

  it('deduplicates completed extractions for the same URL', async () => {
    const container = createTestContainer({ enableMediaProcessing: false });

    const first = await container.extractionJobService.createJob({
      url: 'https://example.com/fake-recipe',
    });

    expect(first.status).toBe('queued');

    const second = await container.extractionJobService.createJob({
      url: 'https://example.com/fake-recipe',
    });

    expect(second.deduplicated).toBe(true);
    expect(second.status).toBe('completed');
    expect(second.recipeId).toBeTruthy();
  });

  it('re-runs extraction when forceRefresh is true', async () => {
    const container = createTestContainer({ enableMediaProcessing: false });

    const first = await container.extractionJobService.createJob({
      url: 'https://example.com/fake-recipe',
    });
    const firstStatus = await container.extractionJobService.getJobStatus(first.jobId);

    const refreshed = await container.extractionJobService.createJob({
      url: 'https://example.com/fake-recipe',
      forceRefresh: true,
    });

    expect(refreshed.deduplicated).toBeUndefined();
    expect(refreshed.status).toBe('queued');

    const refreshedStatus = await container.extractionJobService.getJobStatus(refreshed.jobId);
    expect(refreshedStatus.status).toBe('COMPLETED');
    expect(refreshedStatus.recipeId).toBe(firstStatus.recipeId);

    const recipe = await container.repositories.recipe.findById(refreshedStatus.recipeId!);
    expect(recipe?.title).toBe('Fake pasta recipe');
  });
});
