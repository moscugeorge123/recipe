import { describe, expect, it } from 'vitest';

import {
  assembleImportDetail,
  assembleSummary,
  assembleUsage,
  IMPORT_STAGES,
  type AiUsageInput,
  type ImportJobInput,
  type ProviderUsageInput,
  type StageInput,
} from '../../../../src/modules/dashboard/domain/assemble.js';

function stage(overrides: Partial<StageInput> & Pick<StageInput, 'stage' | 'status'>): StageInput {
  return {
    attempt: 1,
    progress: 100,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    error: null,
    ...overrides,
  };
}

function ai(overrides: Partial<AiUsageInput> & Pick<AiUsageInput, 'id'>): AiUsageInput {
  return {
    provider: 'openai',
    model: 'gpt-4o',
    operation: 'extract',
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0,
    durationMs: 0,
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function charge(
  overrides: Partial<ProviderUsageInput> & Pick<ProviderUsageInput, 'id'>,
): ProviderUsageInput {
  return {
    provider: 'apify',
    operation: 'instagram-scraper',
    sourceType: 'INSTAGRAM',
    units: 1,
    estimatedCostUsd: 0,
    durationMs: 0,
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function job(overrides: Partial<ImportJobInput> = {}): ImportJobInput {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    recipeId: null,
    status: 'QUEUED',
    error: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    startedAt: null,
    completedAt: null,
    recipe: null,
    recipeSource: {
      sourceType: 'INSTAGRAM',
      originalUrl: 'https://www.instagram.com/reel/abc/',
    },
    stages: [],
    aiUsage: [],
    providerUsage: [],
    ...overrides,
  };
}

describe('assemble import detail', () => {
  it('fills missing stages as PENDING and keeps the highest attempt', () => {
    const detail = assembleImportDetail(
      job({
        stages: [
          stage({
            stage: 'TRANSCRIBING',
            status: 'FAILED',
            attempt: 1,
            durationMs: 100,
            error: { message: 'old' },
          }),
          stage({
            stage: 'TRANSCRIBING',
            status: 'COMPLETED',
            attempt: 3,
            progress: 100,
            durationMs: 400,
            error: null,
            startedAt: '2026-10-01T00:00:01.000Z',
            completedAt: '2026-10-01T00:00:01.400Z',
          }),
          stage({
            stage: 'EXTRACTING_RECIPE',
            status: 'FAILED',
            attempt: 1,
            progress: 40,
            durationMs: 50,
            error: { message: 'parse' },
          }),
          stage({
            stage: 'VALIDATING_RECIPE',
            status: 'SKIPPED',
            attempt: 1,
            durationMs: null,
          }),
        ],
      }),
    );

    expect(detail.steps.map((step) => step.stage)).toEqual([...IMPORT_STAGES]);
    expect(detail.stepCount).toBe(8);

    const transcribing = detail.steps.find((step) => step.stage === 'TRANSCRIBING');
    expect(transcribing).toMatchObject({
      status: 'COMPLETED',
      attempt: 3,
      progress: 100,
      durationMs: 400,
      error: null,
      startedAt: '2026-10-01T00:00:01.000Z',
      shareOfTotal: 0.8889,
    });

    const acquiring = detail.steps.find((step) => step.stage === 'ACQUIRING_CONTENT');
    expect(acquiring).toMatchObject({
      status: 'PENDING',
      attempt: 0,
      progress: 0,
      durationMs: null,
      error: null,
      startedAt: null,
      completedAt: null,
      shareOfTotal: 0,
    });

    expect(detail.completedStepCount).toBe(2);
    expect(detail.failedStepCount).toBe(1);
    expect(detail.slowestStep).toBe('TRANSCRIBING');
  });

  it('uses wall-clock duration when both timestamps exist and never goes negative', () => {
    const forward = assembleImportDetail(
      job({
        startedAt: '2026-10-01T00:00:00.000Z',
        completedAt: '2026-10-01T00:00:12.000Z',
        stages: [stage({ stage: 'ACQUIRING_CONTENT', status: 'COMPLETED', durationMs: 100 })],
      }),
    );
    expect(forward.totalDurationMs).toBe(12_000);

    const reversed = assembleImportDetail(
      job({
        startedAt: '2026-10-01T00:00:10.000Z',
        completedAt: '2026-10-01T00:00:00.000Z',
      }),
    );
    expect(reversed.totalDurationMs).toBe(0);

    const open = assembleImportDetail(
      job({
        startedAt: '2026-10-01T00:00:00.000Z',
        stages: [
          stage({ stage: 'ACQUIRING_CONTENT', status: 'COMPLETED', durationMs: 250 }),
          stage({
            stage: 'PROCESSING_MEDIA',
            status: 'RUNNING',
            attempt: 1,
            progress: 10,
            durationMs: 750,
          }),
        ],
      }),
    );
    expect(open.totalDurationMs).toBe(1000);
  });

  it('sums AI and third-party cost, including decimal-like values', () => {
    const detail = assembleImportDetail(
      job({
        recipeId: '22222222-2222-4222-8222-222222222222',
        status: 'COMPLETED',
        recipe: {
          id: '22222222-2222-4222-8222-222222222222',
          title: 'Garlic pasta',
          description: 'Weeknight pasta',
        },
        aiUsage: [
          ai({
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            estimatedCostUsd: '0.010000',
            inputTokens: 100,
            outputTokens: 40,
          }),
          ai({
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            operation: 'validate',
            estimatedCostUsd: { toNumber: () => 0.002345 },
            inputTokens: 20,
            outputTokens: 10,
          }),
        ],
        providerUsage: [
          charge({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', estimatedCostUsd: 0.001 }),
        ],
      }),
    );

    expect(detail.title).toBe('Garlic pasta');
    expect(detail.description).toBe('Weeknight pasta');
    expect(detail.costs).toEqual({
      aiUsd: 0.012345,
      thirdPartyUsd: 0.001,
      totalUsd: 0.013345,
    });
    expect(detail.tokens).toEqual({ input: 120, output: 50 });
    expect(detail.thirdParty[0]?.estimatedCostUsd).toBe(0.001);
    expect(detail.aiUsage[0]?.estimatedCostUsd).toBe(0.01);
  });
});

describe('assemble usage', () => {
  it('groups AI rows by provider and model with nested operations', () => {
    const report = assembleUsage([
      ai({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        provider: 'openai',
        model: 'gpt-4o-mini',
        operation: 'extract',
        inputTokens: 100,
        outputTokens: 20,
        estimatedCostUsd: 0.005,
        durationMs: 30,
      }),
      ai({
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        provider: 'openai',
        model: 'gpt-4o',
        operation: 'extract',
        inputTokens: 10,
        outputTokens: 5,
        estimatedCostUsd: 0.02,
        durationMs: 100,
      }),
      ai({
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        provider: 'openai',
        model: 'gpt-4o',
        operation: 'extract',
        inputTokens: 10,
        outputTokens: 5,
        estimatedCostUsd: 0.03,
        durationMs: 50,
      }),
      ai({
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        provider: 'openai',
        model: 'gpt-4o',
        operation: 'validate',
        inputTokens: 4,
        outputTokens: 2,
        estimatedCostUsd: 0.01,
        durationMs: 20,
      }),
    ]);

    expect(report.byModel.map((model) => model.model)).toEqual(['gpt-4o', 'gpt-4o-mini']);
    expect(report.byModel[0]).toMatchObject({
      provider: 'openai',
      model: 'gpt-4o',
      inputTokens: 24,
      outputTokens: 12,
      estimatedCostUsd: 0.06,
      calls: 3,
      durationMs: 170,
    });
    expect(report.byModel[0]?.operations).toEqual([
      {
        operation: 'extract',
        inputTokens: 20,
        outputTokens: 10,
        estimatedCostUsd: 0.05,
        calls: 2,
        durationMs: 150,
      },
      {
        operation: 'validate',
        inputTokens: 4,
        outputTokens: 2,
        estimatedCostUsd: 0.01,
        calls: 1,
        durationMs: 20,
      },
    ]);
    expect(report.totals).toEqual({
      inputTokens: 124,
      outputTokens: 32,
      estimatedCostUsd: 0.065,
      calls: 4,
    });
  });
});

describe('assemble summary', () => {
  it('counts in-progress jobs and averages stage durations', () => {
    const summary = assembleSummary([
      job({
        id: '11111111-1111-4111-8111-111111111111',
        status: 'COMPLETED',
        recipeId: '22222222-2222-4222-8222-222222222222',
        aiUsage: [
          ai({
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            estimatedCostUsd: 0.01,
            inputTokens: 8,
            outputTokens: 2,
          }),
        ],
        providerUsage: [
          charge({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', estimatedCostUsd: 0.002 }),
        ],
        stages: [
          stage({ stage: 'ACQUIRING_CONTENT', status: 'COMPLETED', durationMs: 1000 }),
          stage({ stage: 'EXTRACTING_RECIPE', status: 'COMPLETED', durationMs: 3000 }),
        ],
      }),
      job({
        id: '33333333-3333-4333-8333-333333333333',
        status: 'COMPLETED',
        recipeId: null,
        stages: [stage({ stage: 'ACQUIRING_CONTENT', status: 'COMPLETED', durationMs: 3000 })],
      }),
      job({ id: '44444444-4444-4444-8444-444444444444', status: 'FAILED' }),
      job({ id: '55555555-5555-4555-8555-555555555555', status: 'CANCELLED' }),
      job({ id: '66666666-6666-4666-8666-666666666666', status: 'QUEUED' }),
      job({ id: '77777777-7777-4777-8777-777777777777', status: 'TRANSCRIBING' }),
    ]);

    expect(summary.importedRecipes).toBe(1);
    expect(summary.jobs).toEqual({
      total: 6,
      completed: 2,
      failed: 1,
      inProgress: 2,
    });
    expect(summary.costs).toEqual({
      aiUsd: 0.01,
      thirdPartyUsd: 0.002,
      totalUsd: 0.012,
    });
    expect(summary.tokens).toEqual({ input: 8, output: 2 });
    expect(summary.slowestSteps).toEqual([
      {
        stage: 'EXTRACTING_RECIPE',
        averageDurationMs: 3000,
        maxDurationMs: 3000,
        sampleCount: 1,
      },
      {
        stage: 'ACQUIRING_CONTENT',
        averageDurationMs: 2000,
        maxDurationMs: 3000,
        sampleCount: 2,
      },
    ]);
  });
});
