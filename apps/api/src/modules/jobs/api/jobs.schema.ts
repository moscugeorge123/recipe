import { z } from 'zod';

export const createExtractionJobBodySchema = z
  .object({
    url: z.url('url must be a valid URL'),
    outputLanguage: z.string().min(2).max(10).default('en'),
    forceRefresh: z.boolean().default(false),
    options: z
      .object({
        extractNutrition: z.boolean().default(false),
        extractImages: z.boolean().default(true),
        highAccuracy: z.boolean().default(false),
      })
      .default({ extractNutrition: false, extractImages: true, highAccuracy: false }),
  })
  .strict();

export const jobIdParamsSchema = z.object({
  id: z.uuid('id must be a UUID'),
});

export const extractionJobResponseSchema = z.object({
  jobId: z.uuid(),
  status: z.enum(['queued', 'completed']),
  recipeId: z.uuid().optional(),
  deduplicated: z.boolean().optional(),
});

export const jobStatusResponseSchema = z.object({
  id: z.uuid(),
  status: z.string(),
  progress: z.number().int(),
  currentStage: z.string().nullable(),
  recipeId: z.uuid().nullable(),
  error: z.unknown().nullable(),
  startedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
});

export const cancelJobResponseSchema = z.object({
  id: z.uuid(),
  status: z.literal('CANCELLED'),
});

export type CreateExtractionJobBody = z.infer<typeof createExtractionJobBodySchema>;
