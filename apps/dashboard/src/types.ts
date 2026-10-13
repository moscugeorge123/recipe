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
  stepCount: number;
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

export interface OperationUsage {
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
  operations: OperationUsage[];
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

export interface SlowStepStat {
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
  slowestSteps: SlowStepStat[];
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

export interface LogEntry {
  timestamp: string;
  level: string;
  msg: string;
  service?: string;
  jobId?: string;
  step?: string;
  durationMs?: number;
  requestId?: string;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PageResult<T> {
  data: T[];
  meta: PageMeta;
}

export interface LogQuery {
  page?: number;
  pageSize?: number;
  level?: string;
  q?: string;
  jobId?: string;
}
