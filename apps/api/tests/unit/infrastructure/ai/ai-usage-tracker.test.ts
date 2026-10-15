import { describe, expect, it } from 'vitest';

import { AIUsageTracker } from '../../../../src/infrastructure/ai/usage/ai-usage-tracker.js';
import { DEFAULT_PRICING, estimateCost } from '../../../../src/infrastructure/ai/usage/pricing.js';
import type { IAIUsageRepository } from '../../../../src/infrastructure/database/repositories/ai-usage.repository.js';

describe('AIUsageTracker', () => {
  it('tracks usage with estimated cost', async () => {
    const records: unknown[] = [];
    const repo: IAIUsageRepository = {
      create: async (input) => {
        records.push(input);
        return { ...input, id: '1', createdAt: new Date() } as never;
      },
      findByJobId: async () => [],
    };

    const tracker = new AIUsageTracker(repo, DEFAULT_PRICING);
    await tracker.track({
      jobId: 'job-1',
      provider: 'openai',
      model: 'gpt-4o-mini',
      operation: 'structured_generation',
      inputTokens: 1000,
      outputTokens: 500,
      durationMs: 1200,
    });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      jobId: 'job-1',
      inputTokens: 1000,
      outputTokens: 500,
    });
    expect((records[0] as { estimatedCostUsd: number }).estimatedCostUsd).toBeGreaterThan(0);
  });

  it('accepts profile-owned usage without an extraction job', async () => {
    const records: unknown[] = [];
    const repo: IAIUsageRepository = {
      create: async (input) => {
        records.push(input);
        return { ...input, id: '2', createdAt: new Date() } as never;
      },
      findByJobId: async () => [],
    };
    const tracker = new AIUsageTracker(repo, DEFAULT_PRICING);

    await tracker.track({
      userId: '00000000-0000-4000-8000-000000000001',
      recipeRevisionId: '00000000-0000-4000-8000-000000000201',
      provider: 'openai',
      model: 'gpt-4o-mini',
      operation: 'pantry_classification',
      inputTokens: 100,
      outputTokens: 50,
      durationMs: 200,
    });

    expect(records[0]).toMatchObject({
      userId: '00000000-0000-4000-8000-000000000001',
      operation: 'pantry_classification',
    });
    expect(records[0]).not.toHaveProperty('jobId');
  });

  it("attributes job usage to the job's requesting user when a default user is set", async () => {
    const records: unknown[] = [];
    const repo: IAIUsageRepository = {
      create: async (input) => {
        records.push(input);
        return { ...input, id: '3', createdAt: new Date() } as never;
      },
      findByJobId: async () => [],
    };
    const tracker = new AIUsageTracker(repo, DEFAULT_PRICING, 'user-from-job');

    await tracker.track({
      jobId: 'job-1',
      provider: 'openai',
      model: 'gpt-4o-mini',
      operation: 'ocr',
      inputTokens: 10,
      outputTokens: 5,
      durationMs: 20,
    });
    await tracker.track({
      jobId: 'job-1',
      userId: 'explicit-user',
      provider: 'openai',
      model: 'gpt-4o-mini',
      operation: 'ocr',
      inputTokens: 10,
      outputTokens: 5,
      durationMs: 20,
    });

    expect(records[0]).toMatchObject({ jobId: 'job-1', userId: 'user-from-job' });
    expect(records[1]).toMatchObject({ userId: 'explicit-user' });
  });
});

describe('estimateCost', () => {
  it('calculates cost from pricing table', () => {
    const cost = estimateCost('gpt-4o-mini', 1000, 1000, DEFAULT_PRICING);
    expect(cost).toBeCloseTo(0.00015 + 0.0006, 5);
  });
});
