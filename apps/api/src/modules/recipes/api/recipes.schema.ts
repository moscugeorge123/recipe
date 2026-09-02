import { z } from 'zod';

import { paginationQuerySchema } from '../../../shared/pagination/pagination.js';
import { dbUuid } from '../../../shared/validation/uuid.js';

export const recipeIdParamsSchema = z.object({
  id: dbUuid('id must be a UUID'),
});

export const recipeRevisionParamsSchema = recipeIdParamsSchema.extend({
  revisionId: dbUuid('revisionId must be a UUID'),
});

const isSingleGrapheme = (value: string): boolean => {
  const Segmenter = Intl.Segmenter;
  return (
    /\p{Extended_Pictographic}/u.test(value) &&
    [...new Segmenter(undefined, { granularity: 'grapheme' }).segment(value)].length === 1
  );
};

const colorTokenSchema = z.enum([
  'paprikaSoft',
  'basilSoft',
  'honey50',
  'peach',
  'linen',
  'steamedMilk',
  'chili50',
]);

export const recipeCategorySchema = z.object({
  id: dbUuid(),
  slug: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
});

export const listRecipesQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(200).optional(),
  cuisine: z.string().trim().min(1).max(80).optional(),
  sourceType: z.enum(['INSTAGRAM', 'YOUTUBE', 'FACEBOOK', 'TIKTOK', 'GENERIC_WEB']).optional(),
  sort: z.enum(['latest', 'engagement']).default('latest'),
});

export type ListRecipesQuery = z.infer<typeof listRecipesQuerySchema>;

export const recipeIngredientSchema = z.object({
  id: dbUuid(),
  name: z.string(),
  canonicalName: z.string().nullable(),
  quantity: z.union([z.string(), z.number()]).nullable(),
  unit: z.string().nullable(),
  preparation: z.string().nullable(),
  optional: z.boolean(),
  emoji: z.string(),
  colorToken: z.string(),
  category: z.string(),
  confidence: z.number(),
  provenance: z.unknown(),
  warnings: z.unknown(),
  sortOrder: z.number().int(),
});

export const recipeStepSchema = z.object({
  id: dbUuid(),
  stepOrder: z.number().int(),
  instruction: z.string(),
  durationMinutes: z.number().int().nullable(),
  temperature: z.string().nullable(),
  stage: z.string(),
  ingredientHint: z.string().nullable(),
  confidence: z.number(),
  provenance: z.unknown(),
  warnings: z.unknown(),
});

export const recipeSourceSchema = z.object({
  id: dbUuid(),
  sourceType: z.string(),
  originalUrl: z.string(),
  normalizedUrl: z.string(),
  metadata: z.unknown(),
  author: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  sourceLabel: z.string(),
  createdAt: z.iso.datetime(),
});

export const recipeDetailSchema = z.object({
  id: dbUuid(),
  title: z.string(),
  description: z.string().nullable(),
  servings: z.number().int().nullable(),
  prepTimeMinutes: z.number().int().nullable(),
  cookTimeMinutes: z.number().int().nullable(),
  totalTimeMinutes: z.number().int().nullable(),
  calories: z.number().int().nullable(),
  cuisine: z.string().nullable(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).nullable(),
  minutes: z.number().int().nullable(),
  nutrition: z.unknown().nullable(),
  sourceLanguage: z.string().nullable(),
  confidence: z.number(),
  warnings: z.unknown(),
  promptVersion: z.string().nullable(),
  userRecipeId: dbUuid(),
  revisionId: dbUuid(),
  revisionNumber: z.number().int().nonnegative(),
  revisionSource: z.enum(['IMPORT', 'USER_EDIT', 'AI_ASSISTED', 'RESTORE', 'MIGRATION']),
  reviewState: z.enum(['NEEDS_REVIEW', 'READY']),
  categories: z.array(recipeCategorySchema),
  isFavorite: z.boolean(),
  rating: z.number().int().min(1).max(5).nullable(),
  ratingAverage: z.number().min(1).max(5).nullable(),
  ratingCount: z.number().int().nonnegative(),
  cookCount: z.number().int().nonnegative(),
  nutritionStatus: z.enum([
    'NOT_REQUESTED',
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'PARTIAL',
    'FAILED',
  ]),
  ingredients: z.array(recipeIngredientSchema),
  steps: z.array(recipeStepSchema),
  source: recipeSourceSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const recipeListItemSchema = z.object({
  id: dbUuid(),
  userRecipeId: dbUuid(),
  title: z.string(),
  description: z.string().nullable(),
  confidence: z.number(),
  sourceLanguage: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  servings: z.number().int().nullable(),
  prepTimeMinutes: z.number().int().nullable(),
  cookTimeMinutes: z.number().int().nullable(),
  totalTimeMinutes: z.number().int().nullable(),
  calories: z.number().int().nullable(),
  cuisine: z.string().nullable(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).nullable(),
  minutes: z.number().int().nullable(),
  sourceType: z.string(),
  sourceLabel: z.string(),
  creator: z.string(),
  originalUrl: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  ingredientCount: z.number().int(),
  stepCount: z.number().int(),
  categories: z.array(recipeCategorySchema),
  isFavorite: z.boolean(),
  rating: z.number().int().min(1).max(5).nullable(),
  ratingAverage: z.number().min(1).max(5).nullable(),
  ratingCount: z.number().int().nonnegative(),
  cookCount: z.number().int().nonnegative(),
  reviewState: z.enum(['NEEDS_REVIEW', 'READY']),
});

export const recipeEngagementSchema = z.object({
  id: dbUuid(),
  userRecipeId: dbUuid(),
  isFavorite: z.boolean(),
  rating: z.number().int().min(1).max(5).nullable(),
  ratingAverage: z.number().min(1).max(5).nullable(),
  ratingCount: z.number().int().nonnegative(),
  cookCount: z.number().int().nonnegative(),
  reviewState: z.enum(['NEEDS_REVIEW', 'READY']),
  updatedAt: z.iso.datetime(),
});

export const engagementConcurrencyBodySchema = z
  .object({
    expectedUpdatedAt: z.iso.datetime().optional(),
  })
  .strict()
  .default({});

export const putRatingBodySchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    expectedUpdatedAt: z.iso.datetime().optional(),
  })
  .strict();

export const putReviewStateBodySchema = z
  .object({
    reviewState: z.enum(['NEEDS_REVIEW', 'READY']),
    expectedUpdatedAt: z.iso.datetime().optional(),
  })
  .strict();

export const engagementConcurrencyQuerySchema = z.object({
  expectedUpdatedAt: z.iso.datetime().optional(),
});

export const recipeNoteSchema = z.object({
  id: dbUuid(),
  recipeId: dbUuid(),
  body: z.string(),
  cookSessionId: dbUuid().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const recipeNoteIdParamsSchema = recipeIdParamsSchema.extend({
  noteId: dbUuid('noteId must be a UUID'),
});

export const createRecipeNoteBodySchema = z
  .object({
    body: z.string().trim().min(1).max(4000),
    cookSessionId: dbUuid().nullable().optional(),
  })
  .strict();

export const patchRecipeNoteBodySchema = z
  .object({
    body: z.string().trim().min(1).max(4000).optional(),
    cookSessionId: dbUuid().nullable().optional(),
  })
  .strict();

export const deleteNoteResponseSchema = z.object({
  id: dbUuid(),
  deleted: z.literal(true),
});

export type EngagementConcurrencyBody = z.infer<typeof engagementConcurrencyBodySchema>;
export type PutRatingBody = z.infer<typeof putRatingBodySchema>;
export type PutReviewStateBody = z.infer<typeof putReviewStateBodySchema>;
export type CreateRecipeNoteBody = z.infer<typeof createRecipeNoteBodySchema>;
export type PatchRecipeNoteBody = z.infer<typeof patchRecipeNoteBodySchema>;

export const deleteRecipeResponseSchema = z.object({
  id: dbUuid(),
  deleted: z.literal(true),
});

const patchRecipeIngredientSchema = z.object({
  name: z.string(),
  canonicalName: z.string().nullable().optional(),
  quantity: z.union([z.string(), z.number()]).nullable().optional(),
  unit: z.string().nullable(),
  preparation: z.string().nullable(),
  optional: z.boolean().default(false),
  emoji: z.string().refine(isSingleGrapheme, 'emoji must be one grapheme').optional(),
  colorToken: colorTokenSchema.optional(),
  category: z.string().optional(),
  confidence: z.number().optional(),
  provenance: z.unknown().optional(),
  warnings: z.unknown().optional(),
  sortOrder: z.number(),
});

const patchRecipeStepSchema = z.object({
  stepOrder: z.number(),
  instruction: z.string(),
  durationMinutes: z.number().int().nullable(),
  temperature: z.string().nullable(),
  stage: z.string().optional(),
  confidence: z.number().optional(),
  provenance: z.unknown().optional(),
  warnings: z.unknown().optional(),
});

export const patchRecipeBodySchema = z
  .object({
    title: z.string().min(1),
    description: z.string().nullable(),
    servings: z.number().int().nullable(),
    prepTimeMinutes: z.number().int().nullable(),
    cookTimeMinutes: z.number().int().nullable(),
    totalTimeMinutes: z.number().int().nullable(),
    calories: z.number().int().nullable(),
    cuisine: z.string().nullable(),
    expectedRevisionNumber: z.number().int().nonnegative(),
    categoryIds: z.array(dbUuid()).min(1),
    ingredients: z.array(patchRecipeIngredientSchema),
    steps: z.array(patchRecipeStepSchema),
  })
  .partial()
  .strict();

export type PatchRecipeBody = z.infer<typeof patchRecipeBodySchema>;

export const restoreRevisionBodySchema = z
  .object({
    expectedRevisionNumber: z.number().int().nonnegative(),
  })
  .strict();
export type RestoreRevisionBody = z.infer<typeof restoreRevisionBodySchema>;

export const recipeRevisionSummarySchema = z.object({
  id: dbUuid(),
  revisionNumber: z.number().int().nonnegative(),
  source: z.enum(['IMPORT', 'USER_EDIT', 'AI_ASSISTED', 'RESTORE', 'MIGRATION']),
  createdAt: z.iso.datetime(),
  title: z.string(),
  isOriginal: z.boolean(),
  summary: z.string(),
  changes: z.array(z.string()),
});

export const recipeRevisionDetailSchema = recipeDetailSchema.extend({
  summary: z.string(),
  changes: z.array(z.string()),
});
