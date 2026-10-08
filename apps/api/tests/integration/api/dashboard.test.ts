import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  disconnectTestDatabase,
  getTestPrisma,
  isDatabaseAvailable,
  resetDatabase,
} from '../../helpers/database.js';

const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)('dashboard API endpoints', () => {
  let app: FastifyInstance;
  const prisma = getTestPrisma();

  beforeAll(async () => {
    await resetDatabase(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    // Loaded lazily so a missing optional dependency cannot prevent this file from skipping
    // when Postgres is down.
    const { buildTestApp } = await import('../../helpers/build-test-app.js');
    const { createTestContainer } = await import('../../../src/shared/di/container.js');
    app = await buildTestApp({ container: createTestContainer({ enableMediaProcessing: false }) });
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it('summarizes imports, lists them, and adds AI plus provider cost', async () => {
    const source = await prisma.recipeSource.create({
      data: {
        sourceType: 'INSTAGRAM',
        originalUrl: 'https://www.instagram.com/reel/cost-dash/',
        normalizedUrl: 'https://www.instagram.com/reel/cost-dash',
        urlHash: 'dashboard-cost-dash',
      },
    });

    const recipe = await prisma.recipe.create({
      data: {
        recipeSourceId: source.id,
        title: 'Garlic pasta',
        description: 'Weeknight pasta',
      },
    });

    const startedAt = new Date('2026-10-01T00:00:00.000Z');
    const completedAt = new Date('2026-10-01T00:00:12.000Z');
    const job = await prisma.extractionJob.create({
      data: {
        recipeSourceId: source.id,
        recipeId: recipe.id,
        status: 'COMPLETED',
        progress: 100,
        outputLanguage: 'en',
        startedAt,
        completedAt,
        createdAt: startedAt,
      },
    });

    await prisma.extractionJob.create({
      data: {
        recipeSourceId: source.id,
        status: 'QUEUED',
        outputLanguage: 'en',
        createdAt: new Date('2026-10-02T00:00:00.000Z'),
      },
    });

    await prisma.extractionStage.createMany({
      data: [
        {
          jobId: job.id,
          stage: 'ACQUIRING_CONTENT',
          status: 'COMPLETED',
          progress: 100,
          attempt: 1,
          durationMs: 2500,
          startedAt,
          completedAt: new Date('2026-10-01T00:00:02.500Z'),
        },
        {
          jobId: job.id,
          stage: 'EXTRACTING_RECIPE',
          status: 'COMPLETED',
          progress: 100,
          attempt: 1,
          durationMs: 7500,
          startedAt: new Date('2026-10-01T00:00:02.500Z'),
          completedAt,
        },
      ],
    });

    await prisma.aIUsage.create({
      data: {
        jobId: job.id,
        provider: 'openai',
        model: 'gpt-4o',
        operation: 'extract',
        inputTokens: 100,
        outputTokens: 40,
        estimatedCostUsd: '0.010000',
        durationMs: 800,
      },
    });
    await prisma.aIUsage.create({
      data: {
        jobId: job.id,
        provider: 'openai',
        model: 'gpt-4o',
        operation: 'validate',
        inputTokens: 20,
        outputTokens: 10,
        estimatedCostUsd: '0.002345',
        durationMs: 200,
      },
    });

    // ProviderUsage is mapped to provider_usage. The generated client exposes prisma.providerUsage.
    await prisma.providerUsage.create({
      data: {
        jobId: job.id,
        provider: 'apify',
        operation: 'instagram-scraper',
        sourceType: 'INSTAGRAM',
        units: 1,
        estimatedCostUsd: '0.001000',
        durationMs: 250,
      },
    });

    const summary = await app.inject({ method: 'GET', url: '/api/v1/dashboard/summary' });
    expect(summary.statusCode).toBe(200);
    expect(summary.json().data.importedRecipes).toBe(1);
    expect(summary.json().data.jobs).toMatchObject({
      total: 2,
      completed: 1,
      failed: 0,
      inProgress: 1,
    });
    const summaryCosts = summary.json().data.costs as {
      aiUsd: number;
      thirdPartyUsd: number;
      totalUsd: number;
    };
    expect(summaryCosts).toEqual({
      aiUsd: 0.012345,
      thirdPartyUsd: 0.001,
      totalUsd: 0.013345,
    });
    expect(summaryCosts.totalUsd).toBe(summaryCosts.aiUsd + summaryCosts.thirdPartyUsd);
    expect(summary.json().data.tokens).toEqual({ input: 120, output: 50 });
    expect(summary.json().data.slowestSteps[0]).toMatchObject({
      stage: 'EXTRACTING_RECIPE',
      averageDurationMs: 7500,
      maxDurationMs: 7500,
      sampleCount: 1,
    });

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/imports?page=1&pageSize=10',
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().meta).toMatchObject({ page: 1, pageSize: 10, total: 2, totalPages: 1 });
    expect(list.json().data[0].status).toBe('QUEUED');
    const listItems = list.json().data as Array<{ jobId: string; status: string }>;
    const completed = listItems.find((item) => item.jobId === job.id);
    expect(completed).toMatchObject({
      recipeId: recipe.id,
      title: 'Garlic pasta',
      sourceType: 'INSTAGRAM',
      sourceUrl: 'https://www.instagram.com/reel/cost-dash/',
      status: 'COMPLETED',
      totalDurationMs: 12000,
      stepCount: 8,
      completedStepCount: 2,
      failedStepCount: 0,
      costs: { aiUsd: 0.012345, thirdPartyUsd: 0.001, totalUsd: 0.013345 },
      tokens: { input: 120, output: 50 },
    });

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboard/imports/${job.id}`,
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.description).toBe('Weeknight pasta');
    expect(detail.json().data.steps).toHaveLength(8);
    expect(detail.json().data.slowestStep).toBe('EXTRACTING_RECIPE');
    expect(detail.json().data.aiUsage).toHaveLength(2);
    expect(detail.json().data.aiByModel).toHaveLength(1);
    expect(detail.json().data.aiByModel[0].operations).toHaveLength(2);
    expect(detail.json().data.thirdParty).toEqual([
      expect.objectContaining({
        provider: 'apify',
        operation: 'instagram-scraper',
        sourceType: 'INSTAGRAM',
        units: 1,
        estimatedCostUsd: 0.001,
        durationMs: 250,
      }),
    ]);
    const detailCosts = detail.json().data.costs as {
      aiUsd: number;
      thirdPartyUsd: number;
      totalUsd: number;
    };
    expect(detailCosts.totalUsd).toBe(detailCosts.aiUsd + detailCosts.thirdPartyUsd);

    const detailSteps = detail.json().data.steps as Array<{ stage: string; shareOfTotal: number }>;
    const extracting = detailSteps.find((step) => step.stage === 'EXTRACTING_RECIPE');
    const acquiring = detailSteps.find((step) => step.stage === 'ACQUIRING_CONTENT');
    expect(extracting?.shareOfTotal).toBe(0.75);
    expect(acquiring?.shareOfTotal).toBe(0.25);

    const usage = await app.inject({ method: 'GET', url: '/api/v1/dashboard/usage' });
    expect(usage.statusCode).toBe(200);
    expect(usage.json().data.totals).toEqual({
      inputTokens: 120,
      outputTokens: 50,
      estimatedCostUsd: 0.012345,
      calls: 2,
    });
    expect(usage.json().data.byModel[0]).toMatchObject({
      provider: 'openai',
      model: 'gpt-4o',
      estimatedCostUsd: 0.012345,
      calls: 2,
    });

    const logs = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/logs?page=1&pageSize=5&q=import',
    });
    expect(logs.statusCode).toBe(200);
    expect(logs.json().data).toEqual([]);
    expect(logs.json().meta).toMatchObject({ page: 1, pageSize: 5, total: 0, totalPages: 0 });
  });

  it('returns 404 when the import job does not exist', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/imports/33333333-3333-4333-8333-333333333333',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.message).toBe('Import job not found');
    expect(response.json().error.code).toBe('NOT_FOUND');
  });
});
