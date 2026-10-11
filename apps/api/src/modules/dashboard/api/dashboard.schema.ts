import { z } from 'zod';

import { paginationQuerySchema } from '../../../shared/pagination/pagination.js';

export const importIdParamsSchema = z.object({
  id: z.uuid('id must be a UUID'),
});

export const dashboardLogsQuerySchema = paginationQuerySchema.extend({
  level: z.string().trim().max(32).optional(),
  jobId: z.string().trim().max(80).optional(),
  q: z.string().trim().max(200).optional(),
});

export type DashboardLogsQuery = z.infer<typeof dashboardLogsQuerySchema>;

const costBreakdownSchema = z.object({
  aiUsd: z.number(),
  thirdPartyUsd: z.number(),
  totalUsd: z.number(),
});

const tokenTotalsSchema = z.object({
  input: z.number().int(),
  output: z.number().int(),
});

export const importListItemSchema = z.object({
  jobId: z.uuid(),
  recipeId: z.uuid().nullable(),
  title: z.string().nullable(),
  sourceType: z.string(),
  sourceUrl: z.string(),
  status: z.string(),
  createdAt: z.iso.datetime(),
  startedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  totalDurationMs: z.number(),
  stepCount: z.literal(8),
  completedStepCount: z.number().int(),
  failedStepCount: z.number().int(),
  costs: costBreakdownSchema,
  tokens: tokenTotalsSchema,
});

const importStepSchema = z.object({
  stage: z.string(),
  status: z.string(),
  attempt: z.number().int(),
  progress: z.number().int(),
  startedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  durationMs: z.number().int().nullable(),
  error: z.unknown(),
  shareOfTotal: z.number(),
});

const aiUsageItemSchema = z.object({
  id: z.uuid(),
  provider: z.string(),
  model: z.string(),
  operation: z.string(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  estimatedCostUsd: z.number(),
  durationMs: z.number().int(),
  createdAt: z.iso.datetime(),
});

const modelUsageOperationSchema = z.object({
  operation: z.string(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  estimatedCostUsd: z.number(),
  calls: z.number().int(),
  durationMs: z.number().int(),
});

const modelUsageSchema = z.object({
  provider: z.string(),
  model: z.string(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  estimatedCostUsd: z.number(),
  calls: z.number().int(),
  durationMs: z.number().int(),
  operations: z.array(modelUsageOperationSchema),
});

const thirdPartyChargeSchema = z.object({
  id: z.uuid(),
  provider: z.string(),
  operation: z.string(),
  sourceType: z.string(),
  units: z.number(),
  estimatedCostUsd: z.number(),
  durationMs: z.number().int(),
  createdAt: z.iso.datetime(),
});

export const importDetailSchema = importListItemSchema.extend({
  description: z.string().nullable(),
  error: z.unknown(),
  steps: z.array(importStepSchema),
  slowestStep: z.string().nullable(),
  aiUsage: z.array(aiUsageItemSchema),
  aiByModel: z.array(modelUsageSchema),
  thirdParty: z.array(thirdPartyChargeSchema),
});

export const dashboardSummarySchema = z.object({
  importedRecipes: z.number().int(),
  jobs: z.object({
    total: z.number().int(),
    completed: z.number().int(),
    failed: z.number().int(),
    inProgress: z.number().int(),
  }),
  costs: costBreakdownSchema,
  tokens: tokenTotalsSchema,
  slowestSteps: z.array(
    z.object({
      stage: z.string(),
      averageDurationMs: z.number(),
      maxDurationMs: z.number(),
      sampleCount: z.number().int(),
    }),
  ),
});

export const usageReportSchema = z.object({
  byModel: z.array(modelUsageSchema),
  totals: z.object({
    inputTokens: z.number().int(),
    outputTokens: z.number().int(),
    estimatedCostUsd: z.number(),
    calls: z.number().int(),
  }),
});

export const logEntrySchema = z.object({
  timestamp: z.string(),
  level: z.string(),
  msg: z.string(),
  service: z.string().optional(),
  jobId: z.string().optional(),
  step: z.string().optional(),
  durationMs: z.number().optional(),
  requestId: z.string().optional(),
});
