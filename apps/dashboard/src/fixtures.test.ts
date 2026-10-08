import { describe, expect, it } from 'vitest';

import { fixtureDetails, fixtureLogs, fixtureSummary, fixtureUsage } from './fixtures';

const byId = (jobId: string) => {
  const found = fixtureDetails.find((item) => item.jobId === jobId);
  if (!found) throw new Error(`missing ${jobId}`);
  return found;
};

describe('fixture ledger', () => {
  it('keeps four imports consistent with summary and usage', () => {
    expect(fixtureDetails).toHaveLength(4);

    const saffron = byId('job_saffron');
    expect(saffron.title).toBe('Saffron chicken');
    expect(saffron.status).toBe('COMPLETED');
    expect(saffron.steps).toHaveLength(8);
    expect(saffron.steps.every((step) => step.status === 'COMPLETED')).toBe(true);
    expect(saffron.slowestStep).toBe('TRANSCRIBING');
    expect(saffron.steps.find((step) => step.stage === 'TRANSCRIBING')?.durationMs).toBe(18000);
    expect(saffron.thirdParty.map((charge) => charge.provider)).toEqual(['apify']);
    expect(saffron.thirdParty[0]?.estimatedCostUsd).toBe(0.0027);
    expect(saffron.aiByModel.map((model) => model.model).sort()).toEqual(['gpt-4o-mini', 'whisper-1']);
    expect(saffron.costs.totalUsd).toBeCloseTo(saffron.costs.aiUsd + saffron.costs.thirdPartyUsd, 6);

    const noodles = byId('job_noodles');
    expect(noodles.title).toBe('Weeknight noodles');
    expect(noodles.slowestStep).toBe('RUNNING_OCR');
    expect(noodles.thirdParty[0]?.provider).toBe('yt-dlp');
    expect(noodles.thirdParty[0]?.estimatedCostUsd).toBe(0);
    expect(noodles.aiByModel.some((model) => model.model === 'gpt-4o')).toBe(true);
    expect(noodles.costs.aiUsd).toBeGreaterThan(saffron.costs.aiUsd);

    const failed = byId('job_failed');
    expect(failed.title).toBeNull();
    expect(failed.status).toBe('FAILED');
    expect(failed.error).toBe('Could not fetch page: 403 Forbidden');
    expect(failed.steps[0]?.status).toBe('FAILED');
    expect(failed.steps[0]?.stage).toBe('ACQUIRING_CONTENT');
    expect(failed.steps.slice(1).every((step) => step.status === 'PENDING')).toBe(true);
    expect(failed.steps.slice(1).every((step) => step.durationMs === null)).toBe(true);

    const confit = byId('job_confit');
    expect(confit.title).toBe('Tomato confit');
    expect(confit.status).toBe('EXTRACTING_RECIPE');
    expect(confit.steps.some((step) => step.status === 'COMPLETED')).toBe(true);
    expect(confit.steps.find((step) => step.stage === 'EXTRACTING_RECIPE')?.status).toBe('RUNNING');
    expect(confit.steps.slice(6).every((step) => step.status === 'PENDING')).toBe(true);

    expect(fixtureSummary.importedRecipes).toBe(2);
    expect(fixtureSummary.jobs).toEqual({ total: 4, completed: 2, failed: 1, inProgress: 1 });
    const ai = fixtureDetails.reduce((sum, item) => sum + item.costs.aiUsd, 0);
    const third = fixtureDetails.reduce((sum, item) => sum + item.costs.thirdPartyUsd, 0);
    expect(fixtureSummary.costs.aiUsd).toBeCloseTo(ai, 6);
    expect(fixtureSummary.costs.thirdPartyUsd).toBeCloseTo(third, 6);
    expect(fixtureSummary.costs.totalUsd).toBeCloseTo(ai + third, 6);
    expect(fixtureSummary.tokens).toEqual({
      input: fixtureDetails.reduce((sum, item) => sum + item.tokens.input, 0),
      output: fixtureDetails.reduce((sum, item) => sum + item.tokens.output, 0),
    });
    expect(fixtureSummary.slowestSteps[0]?.stage).toBe('TRANSCRIBING');

    expect(fixtureUsage.totals.calls).toBe(fixtureDetails.reduce((sum, item) => sum + item.aiUsage.length, 0));
    expect(fixtureUsage.totals.estimatedCostUsd).toBeCloseTo(fixtureSummary.costs.aiUsd, 6);
    expect(fixtureUsage.totals.inputTokens).toBe(fixtureSummary.tokens.input);
    expect(fixtureUsage.byModel.length).toBeGreaterThan(0);

    expect(fixtureLogs).toHaveLength(8);
    expect(new Set(fixtureLogs.map((entry) => entry.level))).toEqual(new Set(['info', 'warn', 'error']));
    expect(fixtureLogs.some((entry) => entry.msg.endsWith('started'))).toBe(true);
    expect(fixtureLogs.some((entry) => entry.msg.endsWith('completed') && entry.durationMs)).toBe(true);
    expect(fixtureLogs.some((entry) => entry.level === 'error' && entry.jobId === 'job_failed')).toBe(true);
    const jobIds = new Set(fixtureDetails.map((item) => item.jobId));
    expect(fixtureLogs.every((entry) => entry.jobId && jobIds.has(entry.jobId))).toBe(true);
  });
});
