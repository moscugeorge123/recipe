/**
 * Pure import-dashboard projections. No database and no HTTP types.
 */

export const IMPORT_STAGES = [
  'ACQUIRING_CONTENT',
  'PROCESSING_MEDIA',
  'TRANSCRIBING',
  'ANALYZING_FRAMES',
  'RUNNING_OCR',
  'EXTRACTING_RECIPE',
  'NORMALIZING_RECIPE',
  'VALIDATING_RECIPE',
] as const;

export type ImportStage = (typeof IMPORT_STAGES)[number];

export type DecimalLike = number | string | { toNumber(): number };

export interface CostBreakdown {
  aiUsd: number;
  thirdPartyUsd: number;
  totalUsd: number;
}

export interface TokenTotals {
  input: number;
  output: number;
}

export interface ImportListItem {
  jobId: string;
  recipeId: string | null;
  title: string | null;
  sourceType: string;
  sourceUrl: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  totalDurationMs: number;
  stepCount: 8;
  completedStepCount: number;
  failedStepCount: number;
  costs: CostBreakdown;
  tokens: TokenTotals;
}

export interface ImportStep {
  stage: string;
  status: string;
  attempt: number;
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  error: unknown;
  shareOfTotal: number;
}

export interface AiUsageItem {
  id: string;
  provider: string;
  model: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  durationMs: number;
  createdAt: string;
}

export interface ModelUsageOperation {
  operation: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  calls: number;
  durationMs: number;
}

export interface ModelUsage {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  calls: number;
  durationMs: number;
  operations: ModelUsageOperation[];
}

export interface ThirdPartyCharge {
  id: string;
  provider: string;
  operation: string;
  sourceType: string;
  units: number;
  estimatedCostUsd: number;
  durationMs: number;
  createdAt: string;
}

export interface ImportDetail extends ImportListItem {
  description: string | null;
  error: unknown;
  steps: ImportStep[];
  slowestStep: string | null;
  aiUsage: AiUsageItem[];
  aiByModel: ModelUsage[];
  thirdParty: ThirdPartyCharge[];
}

export interface SlowestStepAggregate {
  stage: string;
  averageDurationMs: number;
  maxDurationMs: number;
  sampleCount: number;
}

export interface DashboardSummary {
  importedRecipes: number;
  jobs: {
    total: number;
    completed: number;
    failed: number;
    inProgress: number;
  };
  costs: CostBreakdown;
  tokens: TokenTotals;
  slowestSteps: SlowestStepAggregate[];
}

export interface UsageReport {
  byModel: ModelUsage[];
  totals: {
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
    calls: number;
  };
}

export interface StageInput {
  stage: string;
  status: string;
  attempt: number;
  progress: number;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
  durationMs: number | null;
  error: unknown;
}

export interface AiUsageInput {
  id: string;
  provider: string;
  model: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: DecimalLike;
  durationMs: number;
  createdAt: Date | string;
}

export interface ProviderUsageInput {
  id: string;
  provider: string;
  operation: string;
  sourceType: string;
  units: DecimalLike;
  estimatedCostUsd: DecimalLike;
  durationMs: number;
  createdAt: Date | string;
}

export interface ImportJobInput {
  id: string;
  recipeId: string | null;
  status: string;
  error: unknown;
  createdAt: Date | string;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
  recipe: {
    id: string;
    title: string;
    description: string | null;
  } | null;
  recipeSource: {
    sourceType: string;
    originalUrl: string;
  };
  stages: StageInput[];
  aiUsage: AiUsageInput[];
  providerUsage: ProviderUsageInput[];
}

const TERMINAL_JOB_STATUSES: ReadonlySet<string> = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

function roundTo(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return roundTo(value, 6);
}

function toNumber(value: DecimalLike | null | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value != null) {
    const parsed = value.toNumber();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function asInt(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.trunc(value);
}

function toIso(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : null;
  }
  return date.toISOString();
}

function toIsoRequired(value: Date | string): string {
  return toIso(value) ?? new Date(0).toISOString();
}

function sumMoney(values: readonly DecimalLike[]): number {
  const total = values.reduce<number>((sum, value) => sum + toNumber(value), 0);
  return roundMoney(total);
}

function costsFor(job: ImportJobInput): CostBreakdown {
  const aiUsd = sumMoney(job.aiUsage.map((row) => row.estimatedCostUsd));
  const thirdPartyUsd = sumMoney(job.providerUsage.map((row) => row.estimatedCostUsd));
  return {
    aiUsd,
    thirdPartyUsd,
    totalUsd: roundMoney(aiUsd + thirdPartyUsd),
  };
}

function tokensFor(rows: readonly AiUsageInput[]): TokenTotals {
  return {
    input: rows.reduce((sum, row) => sum + asInt(row.inputTokens), 0),
    output: rows.reduce((sum, row) => sum + asInt(row.outputTokens), 0),
  };
}

function selectLatestAttempts(stages: readonly StageInput[]): Map<string, StageInput> {
  const selected = new Map<string, StageInput>();
  for (const stage of stages) {
    const current = selected.get(stage.stage);
    if (current === undefined || stage.attempt >= current.attempt) {
      selected.set(stage.stage, stage);
    }
  }
  return selected;
}

function pendingStep(stage: ImportStage): ImportStep {
  return {
    stage,
    status: 'PENDING',
    attempt: 0,
    progress: 0,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    error: null,
    shareOfTotal: 0,
  };
}

export function assembleSteps(stages: readonly StageInput[]): ImportStep[] {
  const selected = selectLatestAttempts(stages);
  const drafted = IMPORT_STAGES.map((stage): ImportStep => {
    const row = selected.get(stage);
    if (row === undefined) {
      return pendingStep(stage);
    }
    return {
      stage,
      status: row.status,
      attempt: row.attempt,
      progress: row.progress,
      startedAt: toIso(row.startedAt),
      completedAt: toIso(row.completedAt),
      durationMs: row.durationMs,
      error: row.error,
      shareOfTotal: 0,
    };
  });

  const total = drafted.reduce((sum, step) => {
    return step.durationMs === null ? sum : sum + step.durationMs;
  }, 0);

  return drafted.map((step) => {
    const share = step.durationMs === null || total === 0 ? 0 : roundTo(step.durationMs / total, 4);
    return { ...step, shareOfTotal: share };
  });
}

function knownStageDurationMs(steps: readonly ImportStep[]): number {
  const sum = steps.reduce((total, step) => {
    return step.durationMs === null ? total : total + step.durationMs;
  }, 0);
  return Math.max(0, sum);
}

function totalDurationMs(job: ImportJobInput, steps: readonly ImportStep[]): number {
  if (job.startedAt !== null && job.completedAt !== null) {
    const start = new Date(job.startedAt).getTime();
    const end = new Date(job.completedAt).getTime();
    if (Number.isFinite(start) && Number.isFinite(end)) {
      return Math.max(0, end - start);
    }
  }
  return knownStageDurationMs(steps);
}

function slowestStage(steps: readonly ImportStep[]): string | null {
  let best: { stage: string; durationMs: number } | null = null;
  for (const step of steps) {
    if (step.durationMs === null) {
      continue;
    }
    if (best === null || step.durationMs > best.durationMs) {
      best = { stage: step.stage, durationMs: step.durationMs };
    }
  }
  return best?.stage ?? null;
}

export function assembleImportListItem(job: ImportJobInput): ImportListItem {
  const steps = assembleSteps(job.stages);
  return {
    jobId: job.id,
    recipeId: job.recipeId,
    title: job.recipe?.title ?? null,
    sourceType: job.recipeSource.sourceType,
    sourceUrl: job.recipeSource.originalUrl,
    status: job.status,
    createdAt: toIsoRequired(job.createdAt),
    startedAt: toIso(job.startedAt),
    completedAt: toIso(job.completedAt),
    totalDurationMs: totalDurationMs(job, steps),
    stepCount: 8,
    completedStepCount: steps.filter(
      (step) => step.status === 'COMPLETED' || step.status === 'SKIPPED',
    ).length,
    failedStepCount: steps.filter((step) => step.status === 'FAILED').length,
    costs: costsFor(job),
    tokens: tokensFor(job.aiUsage),
  };
}

function toAiUsageItem(row: AiUsageInput): AiUsageItem {
  return {
    id: row.id,
    provider: row.provider,
    model: row.model,
    operation: row.operation,
    inputTokens: asInt(row.inputTokens),
    outputTokens: asInt(row.outputTokens),
    estimatedCostUsd: roundMoney(toNumber(row.estimatedCostUsd)),
    durationMs: row.durationMs,
    createdAt: toIsoRequired(row.createdAt),
  };
}

function toThirdPartyCharge(row: ProviderUsageInput): ThirdPartyCharge {
  return {
    id: row.id,
    provider: row.provider,
    operation: row.operation,
    sourceType: row.sourceType,
    units: toNumber(row.units),
    estimatedCostUsd: roundMoney(toNumber(row.estimatedCostUsd)),
    durationMs: row.durationMs,
    createdAt: toIsoRequired(row.createdAt),
  };
}

interface ModelAccumulator {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  calls: number;
  durationMs: number;
  operations: Map<string, ModelUsageOperation>;
}

export function groupAiByModel(rows: readonly AiUsageInput[]): ModelUsage[] {
  const grouped = new Map<string, ModelAccumulator>();

  for (const row of rows) {
    const key = `${row.provider}\0${row.model}`;
    let model = grouped.get(key);
    if (model === undefined) {
      model = {
        provider: row.provider,
        model: row.model,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        calls: 0,
        durationMs: 0,
        operations: new Map(),
      };
      grouped.set(key, model);
    }

    const inputTokens = asInt(row.inputTokens);
    const outputTokens = asInt(row.outputTokens);
    const estimatedCostUsd = toNumber(row.estimatedCostUsd);
    model.inputTokens += inputTokens;
    model.outputTokens += outputTokens;
    model.estimatedCostUsd += estimatedCostUsd;
    model.calls += 1;
    model.durationMs += row.durationMs;

    const operation = model.operations.get(row.operation) ?? {
      operation: row.operation,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      calls: 0,
      durationMs: 0,
    };
    operation.inputTokens += inputTokens;
    operation.outputTokens += outputTokens;
    operation.estimatedCostUsd += estimatedCostUsd;
    operation.calls += 1;
    operation.durationMs += row.durationMs;
    model.operations.set(row.operation, operation);
  }

  const models = [...grouped.values()].map((model): ModelUsage => {
    const operations = [...model.operations.values()]
      .map((operation) => ({
        ...operation,
        estimatedCostUsd: roundMoney(operation.estimatedCostUsd),
      }))
      .sort((left, right) => {
        if (right.estimatedCostUsd !== left.estimatedCostUsd) {
          return right.estimatedCostUsd - left.estimatedCostUsd;
        }
        return left.operation < right.operation ? -1 : left.operation > right.operation ? 1 : 0;
      });

    return {
      provider: model.provider,
      model: model.model,
      inputTokens: model.inputTokens,
      outputTokens: model.outputTokens,
      estimatedCostUsd: roundMoney(model.estimatedCostUsd),
      calls: model.calls,
      durationMs: model.durationMs,
      operations,
    };
  });

  models.sort((left, right) => {
    if (right.estimatedCostUsd !== left.estimatedCostUsd) {
      return right.estimatedCostUsd - left.estimatedCostUsd;
    }
    if (left.provider !== right.provider) {
      return left.provider < right.provider ? -1 : 1;
    }
    return left.model < right.model ? -1 : left.model > right.model ? 1 : 0;
  });

  return models;
}

export function assembleImportDetail(job: ImportJobInput): ImportDetail {
  const steps = assembleSteps(job.stages);
  return {
    ...assembleImportListItem(job),
    description: job.recipe?.description ?? null,
    error: job.error,
    steps,
    slowestStep: slowestStage(steps),
    aiUsage: job.aiUsage.map(toAiUsageItem),
    aiByModel: groupAiByModel(job.aiUsage),
    thirdParty: job.providerUsage.map(toThirdPartyCharge),
  };
}

function aggregateSlowestSteps(jobs: readonly ImportJobInput[]): SlowestStepAggregate[] {
  const samples = new Map<string, number[]>();

  for (const job of jobs) {
    for (const step of assembleSteps(job.stages)) {
      if (step.durationMs === null) {
        continue;
      }
      const current = samples.get(step.stage);
      if (current === undefined) {
        samples.set(step.stage, [step.durationMs]);
      } else {
        current.push(step.durationMs);
      }
    }
  }

  const rows = [...samples.entries()].map(([stage, durations]): SlowestStepAggregate => {
    const sum = durations.reduce((total, value) => total + value, 0);
    let maxDurationMs = durations[0] ?? 0;
    for (const duration of durations) {
      if (duration > maxDurationMs) {
        maxDurationMs = duration;
      }
    }
    return {
      stage,
      averageDurationMs: sum / durations.length,
      maxDurationMs,
      sampleCount: durations.length,
    };
  });

  rows.sort((left, right) => {
    if (right.averageDurationMs !== left.averageDurationMs) {
      return right.averageDurationMs - left.averageDurationMs;
    }
    return (
      IMPORT_STAGES.indexOf(left.stage as ImportStage) -
      IMPORT_STAGES.indexOf(right.stage as ImportStage)
    );
  });

  return rows;
}

export function assembleSummary(jobs: readonly ImportJobInput[]): DashboardSummary {
  const aiRows = jobs.flatMap((job) => job.aiUsage);
  const thirdPartyRows = jobs.flatMap((job) => job.providerUsage);
  const aiUsd = sumMoney(aiRows.map((row) => row.estimatedCostUsd));
  const thirdPartyUsd = sumMoney(thirdPartyRows.map((row) => row.estimatedCostUsd));

  return {
    importedRecipes: jobs.filter((job) => job.status === 'COMPLETED' && job.recipeId !== null)
      .length,
    jobs: {
      total: jobs.length,
      completed: jobs.filter((job) => job.status === 'COMPLETED').length,
      failed: jobs.filter((job) => job.status === 'FAILED').length,
      inProgress: jobs.filter((job) => !TERMINAL_JOB_STATUSES.has(job.status)).length,
    },
    costs: {
      aiUsd,
      thirdPartyUsd,
      totalUsd: roundMoney(aiUsd + thirdPartyUsd),
    },
    tokens: tokensFor(aiRows),
    slowestSteps: aggregateSlowestSteps(jobs),
  };
}

export function assembleUsage(rows: readonly AiUsageInput[]): UsageReport {
  return {
    byModel: groupAiByModel(rows),
    totals: {
      inputTokens: rows.reduce((sum, row) => sum + asInt(row.inputTokens), 0),
      outputTokens: rows.reduce((sum, row) => sum + asInt(row.outputTokens), 0),
      estimatedCostUsd: sumMoney(rows.map((row) => row.estimatedCostUsd)),
      calls: rows.length,
    },
  };
}
