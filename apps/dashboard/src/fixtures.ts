import type {
  AiUsageItem,
  CostBreakdown,
  DashboardSummary,
  ImportDetail,
  ImportListItem,
  ImportStep,
  LogEntry,
  LogQuery,
  ModelUsage,
  OperationUsage,
  ThirdPartyCharge,
  TokenTotals,
  UsageReport,
} from './types';

const PIPELINE = [
  'ACQUIRING_CONTENT',
  'PROCESSING_MEDIA',
  'TRANSCRIBING',
  'ANALYZING_FRAMES',
  'RUNNING_OCR',
  'EXTRACTING_RECIPE',
  'NORMALIZING_RECIPE',
  'VALIDATING_RECIPE',
] as const;

/** USD per 1k tokens. Matches the API pricing table. */
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'whisper-1': { input: 0.006, output: 0 },
};

type StepStatus = 'COMPLETED' | 'RUNNING' | 'FAILED' | 'PENDING';

interface StepPlan {
  status: StepStatus;
  durationMs: number | null;
  error?: string;
}

function round6(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function aiCost(model: string, inputTokens: number, outputTokens: number): number {
  const rate = PRICING[model] ?? { input: 0, output: 0 };
  return round6((inputTokens / 1000) * rate.input + (outputTokens / 1000) * rate.output);
}

function usage(input: Omit<AiUsageItem, 'estimatedCostUsd'>): AiUsageItem {
  return {
    ...input,
    estimatedCostUsd: aiCost(input.model, input.inputTokens, input.outputTokens),
  };
}

function buildSteps(startedAt: string, plans: readonly StepPlan[]): ImportStep[] {
  if (plans.length !== PIPELINE.length) {
    throw new Error(`Expected ${PIPELINE.length} stages`);
  }
  const total = plans.reduce((sum, plan) => sum + (plan.durationMs ?? 0), 0);
  let cursor = new Date(startedAt).getTime();

  return plans.map((plan, index) => {
    const stage = PIPELINE[index];
    if (!stage) throw new Error('Missing pipeline stage');
    const pending = plan.status === 'PENDING';
    const finished = plan.status === 'COMPLETED' || plan.status === 'FAILED';
    const start = pending ? null : new Date(cursor).toISOString();
    const end =
      finished && plan.durationMs !== null ? new Date(cursor + plan.durationMs).toISOString() : null;
    if (!pending && plan.durationMs !== null) cursor += plan.durationMs;

    let progress = 0;
    if (plan.status === 'COMPLETED') progress = 100;
    else if (plan.status === 'FAILED') progress = 15;
    else if (plan.status === 'RUNNING') progress = 40;

    return {
      stage,
      status: plan.status,
      attempt: pending ? 0 : 1,
      progress,
      startedAt: start,
      completedAt: end,
      durationMs: plan.durationMs,
      error: plan.error ?? null,
      shareOfTotal: total > 0 && plan.durationMs !== null ? plan.durationMs / total : 0,
    };
  });
}

function groupModels(items: readonly AiUsageItem[]): ModelUsage[] {
  const models = new Map<string, ModelUsage>();

  for (const item of items) {
    const key = `${item.provider}\u0000${item.model}`;
    let model = models.get(key);
    if (!model) {
      model = {
        provider: item.provider,
        model: item.model,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        calls: 0,
        durationMs: 0,
        operations: [],
      };
      models.set(key, model);
    }
    model.inputTokens += item.inputTokens;
    model.outputTokens += item.outputTokens;
    model.estimatedCostUsd = round6(model.estimatedCostUsd + item.estimatedCostUsd);
    model.calls += 1;
    model.durationMs += item.durationMs;

    const existing = model.operations.find((operation) => operation.operation === item.operation);
    if (existing) {
      existing.inputTokens += item.inputTokens;
      existing.outputTokens += item.outputTokens;
      existing.estimatedCostUsd = round6(existing.estimatedCostUsd + item.estimatedCostUsd);
      existing.calls += 1;
      existing.durationMs += item.durationMs;
    } else {
      const operation: OperationUsage = {
        operation: item.operation,
        inputTokens: item.inputTokens,
        outputTokens: item.outputTokens,
        estimatedCostUsd: item.estimatedCostUsd,
        calls: 1,
        durationMs: item.durationMs,
      };
      model.operations.push(operation);
    }
  }

  return [...models.values()]
    .map((model) => ({
      ...model,
      operations: [...model.operations].sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd),
    }))
    .sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd);
}

function costsOf(ai: readonly AiUsageItem[], thirdParty: readonly ThirdPartyCharge[]): CostBreakdown {
  const aiUsd = round6(ai.reduce((sum, item) => sum + item.estimatedCostUsd, 0));
  const thirdPartyUsd = round6(thirdParty.reduce((sum, item) => sum + item.estimatedCostUsd, 0));
  return { aiUsd, thirdPartyUsd, totalUsd: round6(aiUsd + thirdPartyUsd) };
}

function tokensOf(ai: readonly AiUsageItem[]): TokenTotals {
  return {
    input: ai.reduce((sum, item) => sum + item.inputTokens, 0),
    output: ai.reduce((sum, item) => sum + item.outputTokens, 0),
  };
}

function slowestStage(steps: readonly ImportStep[]): string | null {
  let best: ImportStep | null = null;
  for (const step of steps) {
    if (step.durationMs === null) continue;
    if (!best || step.durationMs > (best.durationMs ?? 0)) best = step;
  }
  return best?.stage ?? null;
}

interface ImportDraft {
  jobId: string;
  recipeId: string | null;
  title: string | null;
  description: string | null;
  sourceType: string;
  sourceUrl: string;
  status: string;
  createdAt: string;
  startedAt: string;
  error: unknown;
  plans: readonly StepPlan[];
  aiUsage: readonly AiUsageItem[];
  thirdParty: readonly ThirdPartyCharge[];
}

function makeImport(draft: ImportDraft): ImportDetail {
  const steps = buildSteps(draft.startedAt, draft.plans);
  const totalDurationMs = steps.reduce((sum, step) => sum + (step.durationMs ?? 0), 0);
  const terminal = draft.status === 'COMPLETED' || draft.status === 'FAILED';
  return {
    jobId: draft.jobId,
    recipeId: draft.recipeId,
    title: draft.title,
    description: draft.description,
    sourceType: draft.sourceType,
    sourceUrl: draft.sourceUrl,
    status: draft.status,
    createdAt: draft.createdAt,
    startedAt: draft.startedAt,
    completedAt: terminal ? new Date(new Date(draft.startedAt).getTime() + totalDurationMs).toISOString() : null,
    totalDurationMs,
    stepCount: steps.length,
    completedStepCount: steps.filter((step) => step.status === 'COMPLETED').length,
    failedStepCount: steps.filter((step) => step.status === 'FAILED').length,
    costs: costsOf(draft.aiUsage, draft.thirdParty),
    tokens: tokensOf(draft.aiUsage),
    error: draft.error,
    steps,
    slowestStep: slowestStage(steps),
    aiUsage: [...draft.aiUsage],
    aiByModel: groupModels(draft.aiUsage),
    thirdParty: [...draft.thirdParty],
  };
}

const done = (durationMs: number): StepPlan => ({ status: 'COMPLETED', durationMs });
const pending = (): StepPlan => ({ status: 'PENDING', durationMs: null });

const saffronAi: AiUsageItem[] = [
  usage({
    id: 'ai_saffron_extract',
    provider: 'openai',
    model: 'gpt-4o-mini',
    operation: 'extract_recipe',
    inputTokens: 4200,
    outputTokens: 1800,
    durationMs: 4200,
    createdAt: '2026-10-07T14:02:28.000Z',
  }),
  usage({
    id: 'ai_saffron_normalize',
    provider: 'openai',
    model: 'gpt-4o-mini',
    operation: 'normalize_recipe',
    inputTokens: 2100,
    outputTokens: 900,
    durationMs: 780,
    createdAt: '2026-10-07T14:02:34.200Z',
  }),
  usage({
    id: 'ai_saffron_whisper',
    provider: 'openai',
    model: 'whisper-1',
    operation: 'transcribe',
    inputTokens: 1800,
    outputTokens: 640,
    durationMs: 18140,
    createdAt: '2026-10-07T14:02:08.400Z',
  }),
];

const noodlesAi: AiUsageItem[] = [
  usage({
    id: 'ai_noodles_frames',
    provider: 'openai',
    model: 'gpt-4o',
    operation: 'analyze_frames',
    inputTokens: 12400,
    outputTokens: 2100,
    durationMs: 8400,
    createdAt: '2026-10-07T18:04:22.000Z',
  }),
  usage({
    id: 'ai_noodles_ocr',
    provider: 'openai',
    model: 'gpt-4o',
    operation: 'ocr',
    inputTokens: 8600,
    outputTokens: 1400,
    durationMs: 6200,
    createdAt: '2026-10-07T18:04:40.000Z',
  }),
  usage({
    id: 'ai_noodles_extract',
    provider: 'openai',
    model: 'gpt-4o',
    operation: 'extract_recipe',
    inputTokens: 5100,
    outputTokens: 2200,
    durationMs: 5100,
    createdAt: '2026-10-07T18:05:02.000Z',
  }),
  usage({
    id: 'ai_noodles_normalize',
    provider: 'openai',
    model: 'gpt-4o-mini',
    operation: 'normalize_recipe',
    inputTokens: 1800,
    outputTokens: 700,
    durationMs: 900,
    createdAt: '2026-10-07T18:05:10.000Z',
  }),
];

const confitAi: AiUsageItem[] = [
  usage({
    id: 'ai_confit_whisper',
    provider: 'openai',
    model: 'whisper-1',
    operation: 'transcribe',
    inputTokens: 900,
    outputTokens: 320,
    durationMs: 5200,
    createdAt: '2026-10-08T08:40:12.000Z',
  }),
  usage({
    id: 'ai_confit_frames',
    provider: 'openai',
    model: 'gpt-4o-mini',
    operation: 'analyze_frames',
    inputTokens: 2400,
    outputTokens: 600,
    durationMs: 2800,
    createdAt: '2026-10-08T08:40:20.000Z',
  }),
];

const saffronThird: ThirdPartyCharge[] = [
  {
    id: 'tp_saffron_apify',
    provider: 'apify',
    operation: 'instagram_scrape',
    sourceType: 'instagram',
    units: 1,
    estimatedCostUsd: 0.0027,
    durationMs: 2100,
    createdAt: '2026-10-07T14:02:03.200Z',
  },
];

const noodlesThird: ThirdPartyCharge[] = [
  {
    id: 'tp_noodles_ytdlp',
    provider: 'yt-dlp',
    operation: 'download',
    sourceType: 'youtube',
    units: 1,
    estimatedCostUsd: 0,
    durationMs: 4800,
    createdAt: '2026-10-07T18:04:06.000Z',
  },
];

const confitThird: ThirdPartyCharge[] = [
  {
    id: 'tp_confit_apify',
    provider: 'apify',
    operation: 'instagram_scrape',
    sourceType: 'instagram',
    units: 1,
    estimatedCostUsd: 0.0018,
    durationMs: 900,
    createdAt: '2026-10-08T08:40:02.400Z',
  },
];

export const fixtureDetails: ImportDetail[] = [
  makeImport({
    jobId: 'job_saffron',
    recipeId: 'rec_saffron',
    title: 'Saffron chicken',
    description: 'Roast chicken with saffron, green olives, and lemon.',
    sourceType: 'instagram',
    sourceUrl: 'https://www.instagram.com/reel/CsaffronChicken/',
    status: 'COMPLETED',
    createdAt: '2026-10-07T14:02:00.000Z',
    startedAt: '2026-10-07T14:02:01.000Z',
    error: null,
    aiUsage: saffronAi,
    thirdParty: saffronThird,
    plans: [done(2000), done(4000), done(18000), done(3000), done(2400), done(5000), done(1000), done(1000)],
  }),
  makeImport({
    jobId: 'job_noodles',
    recipeId: 'rec_noodles',
    title: 'Weeknight noodles',
    description: 'Soy-butter noodles with greens, pulled from a weeknight video.',
    sourceType: 'youtube',
    sourceUrl: 'https://www.youtube.com/watch?v=weeknightnoodles',
    status: 'COMPLETED',
    createdAt: '2026-10-07T18:04:00.000Z',
    startedAt: '2026-10-07T18:04:01.000Z',
    error: null,
    aiUsage: noodlesAi,
    thirdParty: noodlesThird,
    plans: [done(3000), done(6000), done(3000), done(9000), done(21600), done(7000), done(1000), done(2000)],
  }),
  makeImport({
    jobId: 'job_failed',
    recipeId: null,
    title: null,
    description: null,
    sourceType: 'generic-web',
    sourceUrl: 'https://www.example.com/recipes/missing-page',
    status: 'FAILED',
    createdAt: '2026-10-07T21:15:00.000Z',
    startedAt: '2026-10-07T21:15:01.000Z',
    error: 'Could not fetch page: 403 Forbidden',
    aiUsage: [],
    thirdParty: [],
    plans: [
      { status: 'FAILED', durationMs: 4000, error: 'Could not fetch page: 403 Forbidden' },
      pending(),
      pending(),
      pending(),
      pending(),
      pending(),
      pending(),
      pending(),
    ],
  }),
  makeImport({
    jobId: 'job_confit',
    recipeId: null,
    title: 'Tomato confit',
    description: 'Cherry tomatoes confited in olive oil.',
    sourceType: 'instagram',
    sourceUrl: 'https://www.instagram.com/p/tomatoconfit/',
    status: 'EXTRACTING_RECIPE',
    createdAt: '2026-10-08T08:40:00.000Z',
    startedAt: '2026-10-08T08:40:01.000Z',
    error: null,
    aiUsage: confitAi,
    thirdParty: confitThird,
    plans: [
      done(1000),
      done(2000),
      done(6000),
      done(3000),
      done(2400),
      { status: 'RUNNING', durationMs: 3000 },
      pending(),
      pending(),
    ],
  }),
];

export function toListItem(detail: ImportDetail): ImportListItem {
  return {
    jobId: detail.jobId,
    recipeId: detail.recipeId,
    title: detail.title,
    sourceType: detail.sourceType,
    sourceUrl: detail.sourceUrl,
    status: detail.status,
    createdAt: detail.createdAt,
    startedAt: detail.startedAt,
    completedAt: detail.completedAt,
    totalDurationMs: detail.totalDurationMs,
    stepCount: detail.stepCount,
    completedStepCount: detail.completedStepCount,
    failedStepCount: detail.failedStepCount,
    costs: detail.costs,
    tokens: detail.tokens,
  };
}

const TERMINAL_FAILURE = new Set(['FAILED', 'CANCELLED']);
const TERMINAL_SUCCESS = new Set(['COMPLETED']);

export function buildSummary(imports: readonly ImportDetail[]): DashboardSummary {
  const completed = imports.filter((item) => TERMINAL_SUCCESS.has(item.status));
  const failed = imports.filter((item) => item.status === 'FAILED');
  const inProgress = imports.filter(
    (item) => !TERMINAL_SUCCESS.has(item.status) && !TERMINAL_FAILURE.has(item.status),
  );

  const costs = imports.reduce<CostBreakdown>(
    (sum, item) => ({
      aiUsd: round6(sum.aiUsd + item.costs.aiUsd),
      thirdPartyUsd: round6(sum.thirdPartyUsd + item.costs.thirdPartyUsd),
      totalUsd: round6(sum.totalUsd + item.costs.totalUsd),
    }),
    { aiUsd: 0, thirdPartyUsd: 0, totalUsd: 0 },
  );

  const tokens = imports.reduce<TokenTotals>(
    (sum, item) => ({
      input: sum.input + item.tokens.input,
      output: sum.output + item.tokens.output,
    }),
    { input: 0, output: 0 },
  );

  const samples = new Map<string, number[]>();
  for (const item of imports) {
    for (const step of item.steps) {
      if (step.durationMs === null) continue;
      if (step.status !== 'COMPLETED' && step.status !== 'FAILED') continue;
      const durations = samples.get(step.stage) ?? [];
      durations.push(step.durationMs);
      samples.set(step.stage, durations);
    }
  }

  const slowestSteps = [...samples.entries()]
    .map(([stage, durations]) => ({
      stage,
      averageDurationMs: durations.reduce((sum, value) => sum + value, 0) / durations.length,
      maxDurationMs: Math.max(...durations),
      sampleCount: durations.length,
    }))
    .sort((a, b) => b.averageDurationMs - a.averageDurationMs);

  return {
    importedRecipes: completed.filter((item) => item.recipeId).length,
    jobs: {
      total: imports.length,
      completed: completed.length,
      failed: failed.length,
      inProgress: inProgress.length,
    },
    costs,
    tokens,
    slowestSteps,
  };
}

export function buildUsage(imports: readonly ImportDetail[]): UsageReport {
  const items = imports.flatMap((item) => item.aiUsage);
  return {
    byModel: groupModels(items),
    totals: {
      inputTokens: items.reduce((sum, item) => sum + item.inputTokens, 0),
      outputTokens: items.reduce((sum, item) => sum + item.outputTokens, 0),
      estimatedCostUsd: round6(items.reduce((sum, item) => sum + item.estimatedCostUsd, 0)),
      calls: items.length,
    },
  };
}

export const fixtureSummary: DashboardSummary = buildSummary(fixtureDetails);
export const fixtureUsage: UsageReport = buildUsage(fixtureDetails);

export const fixtureLogs: LogEntry[] = [
  {
    timestamp: '2026-10-08T08:40:28.220Z',
    level: 'info',
    msg: 'EXTRACTING_RECIPE started',
    service: 'worker',
    jobId: 'job_confit',
    step: 'EXTRACTING_RECIPE',
    requestId: 'req_confit_extract',
  },
  {
    timestamp: '2026-10-08T08:40:18.100Z',
    level: 'info',
    msg: 'TRANSCRIBING completed',
    service: 'worker',
    jobId: 'job_confit',
    step: 'TRANSCRIBING',
    durationMs: 6000,
    requestId: 'req_confit_tx',
  },
  {
    timestamp: '2026-10-08T08:40:03.400Z',
    level: 'warn',
    msg: 'Apify actor returned a partial media set',
    service: 'api',
    jobId: 'job_confit',
    step: 'ACQUIRING_CONTENT',
    requestId: 'req_confit_acquire',
  },
  {
    timestamp: '2026-10-07T21:15:05.884Z',
    level: 'error',
    msg: 'ACQUIRING_CONTENT failed',
    service: 'worker',
    jobId: 'job_failed',
    step: 'ACQUIRING_CONTENT',
    durationMs: 4000,
    requestId: 'req_8c1f0a',
  },
  {
    timestamp: '2026-10-07T18:04:53.610Z',
    level: 'info',
    msg: 'VALIDATING_RECIPE completed',
    service: 'worker',
    jobId: 'job_noodles',
    step: 'VALIDATING_RECIPE',
    durationMs: 2000,
    requestId: 'req_noodles_validate',
  },
  {
    timestamp: '2026-10-07T18:04:44.200Z',
    level: 'warn',
    msg: 'RUNNING_OCR completed',
    service: 'worker',
    jobId: 'job_noodles',
    step: 'RUNNING_OCR',
    durationMs: 21600,
    requestId: 'req_noodles_ocr',
  },
  {
    timestamp: '2026-10-07T14:02:37.400Z',
    level: 'info',
    msg: 'VALIDATING_RECIPE completed',
    service: 'worker',
    jobId: 'job_saffron',
    step: 'VALIDATING_RECIPE',
    durationMs: 1000,
    requestId: 'req_saffron_validate',
  },
  {
    timestamp: '2026-10-07T14:02:08.200Z',
    level: 'info',
    msg: 'TRANSCRIBING started',
    service: 'worker',
    jobId: 'job_saffron',
    step: 'TRANSCRIBING',
    requestId: 'req_saffron_tx',
  },
];

export function filterLogs(entries: readonly LogEntry[], query: LogQuery): LogEntry[] {
  const level = query.level && query.level !== 'all' ? query.level.toLowerCase() : '';
  const q = query.q?.trim().toLowerCase() ?? '';
  const jobId = query.jobId?.trim() ?? '';

  return entries.filter((entry) => {
    if (level && entry.level.toLowerCase() !== level) return false;
    if (jobId && entry.jobId !== jobId) return false;
    if (!q) return true;
    const haystack = [entry.msg, entry.step, entry.service, entry.jobId, entry.level, entry.requestId]
      .filter((part): part is string => Boolean(part))
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}
