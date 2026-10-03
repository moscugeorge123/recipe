import { describe, expect, it, vi } from 'vitest';

import { config, type AppConfig } from '../../../../src/config/env.js';
import { GenericWebContentProvider } from '../../../../src/modules/content/providers/generic/generic-web-content-provider.js';
import {
  createDefaultStageHandlers,
  StageOrchestrator,
  type PipelineContext,
  type StageHandlerDeps,
} from '../../../../src/modules/extraction/application/stage-orchestrator.js';
import { NotARecipeError } from '../../../../src/shared/errors/extraction-errors.js';
import { htmlFetch, webFixture } from '../../../helpers/web-fixtures.js';

const acquireCtx = { jobId: 'job-1', outputLanguage: 'en', tempDir: '/tmp/test' };

const mockAiConfig = {
  ...config,
  ai: { ...config.ai, openaiApiKey: undefined },
  extraction: { ...config.extraction, fakePipelineDelayMs: 0 },
} as AppConfig;

function extractionDeps() {
  const recipeCreate = vi.fn((input: Record<string, unknown>) =>
    Promise.resolve({ id: 'recipe-1', ...input }),
  );
  const createEvidence = vi.fn(() => Promise.resolve());
  const deps = {
    jobRepo: {
      findById: () =>
        Promise.resolve({
          id: 'job-1',
          recipeSourceId: 'src-1',
          options: {},
          status: 'EXTRACTING_RECIPE',
        }),
      update: vi.fn(() => Promise.resolve({})),
      clearRecipeIdExcept: vi.fn(() => Promise.resolve()),
    },
    evidenceRepo: { createMany: createEvidence },
    aiUsageRepo: {
      create: vi.fn(() => Promise.resolve({})),
      findByJobId: () => Promise.resolve([]),
    },
    recipeRepo: { findBySourceId: () => Promise.resolve(null), create: recipeCreate },
    config: mockAiConfig,
  } as unknown as StageHandlerDeps;
  return { deps, recipeCreate, createEvidence };
}

async function ctxFor(fixture: string): Promise<PipelineContext> {
  const url = `https://site.example/${fixture}`;
  const acquiredContent = await new GenericWebContentProvider({
    fetchImpl: htmlFetch(webFixture(fixture)),
  }).acquire(url, acquireCtx);
  return { jobId: 'job-1', sourceUrl: url, outputLanguage: 'en', acquiredContent };
}

describe('EXTRACTING_RECIPE food-recipe gate (mock AI)', () => {
  it.each(['news-article.html', 'recipe-for-success.html', 'product-page.html'])(
    'rejects %s with NOT_A_RECIPE and saves no recipe',
    async (fixture) => {
      const { deps, recipeCreate, createEvidence } = extractionDeps();
      const handler = createDefaultStageHandlers(deps).EXTRACTING_RECIPE;

      await expect(handler?.(await ctxFor(fixture))).rejects.toBeInstanceOf(NotARecipeError);
      expect(recipeCreate).not.toHaveBeenCalled();
      expect(createEvidence).toHaveBeenCalledOnce();
    },
  );

  it('saves a recipe from a JSON-LD page, with structured data in the prompt evidence', async () => {
    const { deps, recipeCreate } = extractionDeps();
    const handler = createDefaultStageHandlers(deps).EXTRACTING_RECIPE;
    const ctx = await ctxFor('recipe-blog-jsonld.html');

    await handler?.(ctx);

    expect(recipeCreate).toHaveBeenCalledOnce();
    expect(ctx.recipeId).toBe('recipe-1');
    const structured = ctx.evidence?.find((e) => e.metadata?.field === 'structured_recipe');
    expect(structured?.value).toContain('- 8 bone-in chicken thighs');
    expect(structured?.value).toContain('3. Roast for 30 minutes until golden.');
    expect(structured?.value).toContain(
      'Prep time: 10 min | Cook time: 30 min | Total time: 40 min',
    );
  });

  it('saves a recipe from a text-only recipe page', async () => {
    const { deps, recipeCreate } = extractionDeps();
    await createDefaultStageHandlers(deps).EXTRACTING_RECIPE?.(
      await ctxFor('recipe-text-only.html'),
    );
    expect(recipeCreate).toHaveBeenCalledOnce();
  });
});

describe('StageOrchestrator failure serialization', () => {
  it('marks the job FAILED with error.code NOT_A_RECIPE', async () => {
    const job: Record<string, unknown> = {
      id: 'job-1',
      status: 'QUEUED',
      options: {},
      startedAt: null,
    };
    const stages = new Map<string, Record<string, unknown>>();
    const jobRepo = {
      findById: () => Promise.resolve({ ...job }),
      update: (_id: string, patch: Record<string, unknown>) => {
        Object.assign(job, patch);
        return Promise.resolve({ ...job });
      },
    };
    const stageRepo = {
      findByJobAndStage: (_jobId: string, stage: string) =>
        Promise.resolve(stages.get(stage) ?? null),
      create: (input: Record<string, unknown>) => {
        const row = { id: String(input.stage), startedAt: null, ...input };
        stages.set(String(input.stage), row);
        return Promise.resolve(row);
      },
      update: (id: string, patch: Record<string, unknown>) => {
        Object.assign(stages.get(id) ?? {}, patch);
        return Promise.resolve({});
      },
    };

    const orchestrator = new StageOrchestrator(jobRepo as never, stageRepo as never, {
      EXTRACTING_RECIPE: () => Promise.reject(new NotARecipeError()),
    });

    await expect(
      orchestrator.runStages({
        jobId: 'job-1',
        sourceUrl: 'https://x.example',
        outputLanguage: 'en',
      }),
    ).rejects.toBeInstanceOf(NotARecipeError);

    expect(job.status).toBe('FAILED');
    expect(job.error).toEqual({
      message: 'The link does not look like a food recipe',
      code: 'NOT_A_RECIPE',
    });
    expect(job.recipeId).toBeUndefined();
    expect(stages.get('EXTRACTING_RECIPE')?.status).toBe('FAILED');
    expect(stages.has('VALIDATING_RECIPE')).toBe(false);
  });
});
