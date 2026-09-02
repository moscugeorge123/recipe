import { z } from 'zod';

const countByKeySchema = z.record(z.string(), z.number().int().nonnegative());

const aiOperationSchema = z.object({
  operation: z.string(),
  model: z.string(),
  calls: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
});

export const opsSummarySchema = z
  .object({
    generatedAt: z.iso.datetime(),
    profileScoped: z.boolean(),
    ai: z.object({
      calls: z.number().int().nonnegative(),
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
      estimatedCostUsd: z.number().nonnegative(),
      cacheCalls: z.number().int().nonnegative(),
      escalationCalls: z.number().int().nonnegative(),
      byOperation: z.array(aiOperationSchema),
    }),
    usda: z.object({
      queryCacheEntries: z.number().int().nonnegative(),
      foodCacheEntries: z.number().int().nonnegative(),
      rateLimitedPersisted: z.literal(false),
      rateLimitedLogFilter: z.string(),
    }),
    nutrition: z.object({
      byStatus: countByKeySchema,
      failed: z.number().int().nonnegative(),
      inFlight: z.number().int().nonnegative(),
    }),
    pantry: z.object({
      items: z.number().int().nonnegative(),
      fallbackItems: z.number().int().nonnegative(),
      fallbackRate: z.number().nonnegative(),
    }),
    revisions: z.object({
      count: z.number().int().nonnegative(),
      conflictsPersisted: z.literal(false),
      conflictLogFilter: z.string(),
    }),
    queues: z.object({
      extractionByStatus: countByKeySchema,
      extractionInFlight: z.number().int().nonnegative(),
      nutritionInFlight: z.number().int().nonnegative(),
    }),
    migrations: z.object({
      applied: z.number().int().nonnegative(),
      lastApplied: z.string().nullable(),
    }),
  })
  .meta({
    id: 'OpsSummary',
    description:
      'Aggregated operational counters for the singleton profile. No recipe titles, notes, or pantry names.',
  });

export type OpsSummary = z.infer<typeof opsSummarySchema>;
