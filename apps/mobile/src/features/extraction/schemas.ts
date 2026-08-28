import { z } from 'zod';

export const createExtractionBodySchema = z.object({
  url: z.string(),
  outputLanguage: z.string().optional(),
  forceRefresh: z.boolean().optional(),
  options: z
    .object({
      extractNutrition: z.boolean().optional(),
      extractImages: z.boolean().optional(),
      highAccuracy: z.boolean().optional(),
    })
    .optional(),
});

export const extractionJobCreateSchema = z.object({
  jobId: z.string(),
  status: z.enum(['queued', 'completed']),
  recipeId: z.string().optional(),
  deduplicated: z.boolean().optional(),
});

export const jobStatusSchema = z.object({
  id: z.string(),
  status: z.string(),
  progress: z.number(),
  currentStage: z.string().nullable(),
  recipeId: z.string().nullable(),
  error: z.unknown().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
});

export const cancelJobSchema = z.object({
  id: z.string(),
  status: z.literal('CANCELLED'),
});

export type ExtractionJobCreate = z.infer<typeof extractionJobCreateSchema>;
export type JobStatusDto = z.infer<typeof jobStatusSchema>;
