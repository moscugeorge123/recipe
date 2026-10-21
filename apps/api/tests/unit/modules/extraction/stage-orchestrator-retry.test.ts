import { describe, expect, it, vi } from 'vitest';

import { StageOrchestrator } from '../../../../src/modules/extraction/application/stage-orchestrator.js';
import { PIPELINE_STAGE_ORDER } from '../../../../src/modules/jobs/domain/job-status.js';

function harness(initialStatus: string) {
  const job: Record<string, unknown> = {
    id: 'job-1',
    status: initialStatus,
    options: {},
    startedAt: new Date(),
    error: { message: 'bad json' },
    completedAt: new Date(),
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
    findByJobAndStage: (_jobId: string, stage: string) => Promise.resolve(stages.get(stage) ?? null),
    listByJobId: () => Promise.resolve([...stages.values()]),
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
  return { job, stages, jobRepo, stageRepo };
}

describe('StageOrchestrator retry', () => {
  it('resumes a failed extraction and skips stages that already completed', async () => {
    const { job, stages, jobRepo, stageRepo } = harness('FAILED');
    const extractAt = PIPELINE_STAGE_ORDER.indexOf('EXTRACTING_RECIPE');
    for (const stage of PIPELINE_STAGE_ORDER.slice(0, extractAt)) {
      stages.set(stage, { id: stage, stage, status: 'COMPLETED', startedAt: new Date() });
    }
    stages.set('EXTRACTING_RECIPE', {
      id: 'EXTRACTING_RECIPE',
      stage: 'EXTRACTING_RECIPE',
      status: 'FAILED',
      startedAt: new Date(),
    });

    const extract = vi.fn(() => Promise.resolve());
    const orchestrator = new StageOrchestrator(jobRepo as never, stageRepo as never, {
      EXTRACTING_RECIPE: extract,
    });

    await orchestrator.runStages({
      jobId: 'job-1',
      sourceUrl: 'https://www.instagram.com/reel/example',
      outputLanguage: 'ro',
    });

    expect(extract).toHaveBeenCalledOnce();
    expect(job.status).toBe('COMPLETED');
    expect(job.error).toBeNull();
    expect(stages.get('ACQUIRING_CONTENT')?.status).toBe('COMPLETED');
    expect(stages.get('EXTRACTING_RECIPE')?.status).toBe('COMPLETED');
  });

  it('does not resume a failure from before extraction', async () => {
    const { job, stages, jobRepo, stageRepo } = harness('FAILED');
    stages.set('ACQUIRING_CONTENT', {
      id: 'ACQUIRING_CONTENT',
      stage: 'ACQUIRING_CONTENT',
      status: 'FAILED',
      startedAt: new Date(),
    });
    const acquire = vi.fn(() => Promise.resolve());
    const orchestrator = new StageOrchestrator(jobRepo as never, stageRepo as never, {
      ACQUIRING_CONTENT: acquire,
    });

    await orchestrator.runStages({
      jobId: 'job-1',
      sourceUrl: 'https://www.instagram.com/reel/example',
      outputLanguage: 'ro',
    });

    expect(acquire).not.toHaveBeenCalled();
    expect(job.status).toBe('FAILED');
  });
});
