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
});

describe('estimateCost', () => {
  it('calculates cost from pricing table', () => {
    const cost = estimateCost('gpt-4o-mini', 1000, 1000, DEFAULT_PRICING);
    expect(cost).toBeCloseTo(0.00015 + 0.0006, 5);
  });
});
