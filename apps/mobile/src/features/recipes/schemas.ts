import { z } from 'zod';

import { isOneEmoji } from '@/features/recipes/emoji';

export const recipeDifficultySchema = z.enum(['Easy', 'Medium', 'Hard']);
const oneEmojiSchema = z
  .string()
  .refine((value) => isOneEmoji(value), 'Use one emoji');

// Optional so cached pre-upgrade detail payloads still parse.
export const ingredientMeasurementSchema = z.object({
  quantity: z.union([z.string(), z.number()]).nullable(),
  unit: z.string().nullable(),
});

export const recipeIngredientSchema = z.object({
  id: z.string(),
  name: z.string(),
  canonicalName: z.string().nullable(),
  quantity: z.union([z.string(), z.number()]).nullable(),
  unit: z.string().nullable(),
  metric: ingredientMeasurementSchema.nullable().optional(),
  imperial: ingredientMeasurementSchema.nullable().optional(),
  preparation: z.string().nullable(),
  optional: z.boolean(),
  emoji: z.string().optional(),
  colorToken: z.string().optional(),
  category: z.string(),
  confidence: z.number(),
  provenance: z.unknown(),
  warnings: z.unknown(),
  sortOrder: z.number().int(),
});

export const recipeStepSchema = z.object({
  id: z.string(),
  stepOrder: z.number().int(),
  title: z.string().nullable().optional(),
  instruction: z.string(),
  durationMinutes: z.number().int().nullable(),
  temperature: z.string().nullable(),
  temperatureCelsius: z.number().int().nullable().optional(),
  temperatureFahrenheit: z.number().int().nullable().optional(),
  ingredientRefs: z.array(z.number().int().nonnegative()).optional(),
  stage: z.string(),
  ahead: z.boolean().optional(),
  ingredientHint: z.string().nullable(),
  confidence: z.number(),
  provenance: z.unknown(),
  warnings: z.unknown(),
});

export const recipeSourceSchema = z.object({
  id: z.string(),
  sourceType: z.string(),
  originalUrl: z.string(),
  normalizedUrl: z.string(),
  metadata: z.unknown(),
  author: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  sourceLabel: z.string(),
  createdAt: z.string(),
});

export const recipeDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  servings: z.number().int().nullable(),
  prepTimeMinutes: z.number().int().nullable(),
  cookTimeMinutes: z.number().int().nullable(),
  totalTimeMinutes: z.number().int().nullable(),
  calories: z.number().int().nullable(),
  nutritionSource: z.enum(['stated', 'estimated']).nullable().optional(),
  cuisine: z.string().nullable(),
  difficulty: recipeDifficultySchema.nullable(),
  minutes: z.number().int().nullable(),
  nutrition: z.unknown().nullable(),
  sourceLanguage: z.string().nullable(),
  confidence: z.number(),
  warnings: z.unknown(),
  promptVersion: z.string().nullable(),
  userRecipeId: z.string().optional(),
  revisionId: z.string().optional(),
  revisionNumber: z.number().int().nonnegative().optional(),
  revisionSource: z
    .enum(['IMPORT', 'USER_EDIT', 'AI_ASSISTED', 'RESTORE', 'MIGRATION'])
    .optional(),
  reviewState: z.enum(['NEEDS_REVIEW', 'READY']).optional(),
  categories: z
    .array(
      z.object({
        id: z.string(),
        slug: z.string(),
        name: z.string(),
        sortOrder: z.number().int(),
      }),
    )
    .optional(),
  isFavorite: z.boolean().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  ratingAverage: z.number().min(1).max(5).nullable().optional(),
  ratingCount: z.number().int().nonnegative().optional(),
  cookCount: z.number().int().nonnegative().optional(),
  ingredients: z.array(recipeIngredientSchema),
  steps: z.array(recipeStepSchema),
  source: recipeSourceSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const recipeListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  confidence: z.number(),
  sourceLanguage: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  servings: z.number().int().nullable(),
  prepTimeMinutes: z.number().int().nullable(),
  cookTimeMinutes: z.number().int().nullable(),
  totalTimeMinutes: z.number().int().nullable(),
  calories: z.number().int().nullable(),
  cuisine: z.string().nullable(),
  difficulty: recipeDifficultySchema.nullable(),
  minutes: z.number().int().nullable(),
  sourceType: z.string(),
  sourceLabel: z.string(),
  creator: z.string(),
  originalUrl: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  ingredientCount: z.number().int(),
  stepCount: z.number().int(),
  userRecipeId: z.string().optional(),
  categories: z
    .array(
      z.object({
        id: z.string(),
        slug: z.string(),
        name: z.string(),
        sortOrder: z.number().int(),
      }),
    )
    .optional()
    .default([]),
  isFavorite: z.boolean().optional().default(false),
  rating: z.number().int().min(1).max(5).nullable().optional().default(null),
  ratingAverage: z.number().min(1).max(5).nullable().optional().default(null),
  ratingCount: z.number().int().nonnegative().optional().default(0),
  cookCount: z.number().int().nonnegative().optional().default(0),
  // Omit rather than default: missing reviewState must not invent inbox ownership.
  reviewState: z.enum(['NEEDS_REVIEW', 'READY']).optional(),
});

export const recipeEngagementSchema = z.object({
  id: z.string(),
  userRecipeId: z.string(),
  isFavorite: z.boolean(),
  rating: z.number().int().min(1).max(5).nullable(),
  ratingAverage: z.number().min(1).max(5).nullable(),
  ratingCount: z.number().int().nonnegative(),
  cookCount: z.number().int().nonnegative(),
  reviewState: z.enum(['NEEDS_REVIEW', 'READY']).optional(),
  updatedAt: z.string(),
});

export const recipeNoteSchema = z.object({
  id: z.string(),
  recipeId: z.string(),
  body: z.string(),
  cookSessionId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const paginationMetaSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

export const deleteRecipeResponseSchema = z.object({
  id: z.string(),
  deleted: z.literal(true),
});

export const patchRecipeBodySchema = z.object({
  expectedRevisionNumber: z.number().int().nonnegative(),
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  servings: z.number().int().nullable().optional(),
  prepTimeMinutes: z.number().int().nullable().optional(),
  cookTimeMinutes: z.number().int().nullable().optional(),
  totalTimeMinutes: z.number().int().nullable().optional(),
  difficulty: recipeDifficultySchema.nullable().optional(),
  calories: z.number().int().nullable().optional(),
  cuisine: z.string().nullable().optional(),
  categoryIds: z.array(z.string()).min(1),
  ingredients: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        canonicalName: z.string().nullable(),
        emoji: oneEmojiSchema,
        colorToken: z.string().min(1),
        quantity: z.union([z.string(), z.number()]).nullable(),
        unit: z.string().nullable(),
        preparation: z.string().nullable(),
        optional: z.boolean(),
        category: z.string(),
        sortOrder: z.number().int().nonnegative(),
      }),
    )
    .min(1),
  steps: z
    .array(
      z
        .object({
          stepOrder: z.number().int().positive(),
          title: z.string().nullable().optional(),
          instruction: z.string(),
          durationMinutes: z.number().int().nonnegative().nullable(),
          temperature: z.string().nullable(),
          stage: z.string(),
          ahead: z.boolean().optional(),
        })
        .refine(
          (step) => step.instruction.trim().length > 0 || Boolean(step.title?.trim()),
          { message: 'Add step text', path: ['instruction'] },
        ),
    )
    .min(1),
});

export const categorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
  recipeCount: z.number().int(),
  isDefault: z.boolean(),
});

export const recipeRevisionSummarySchema = z.object({
  id: z.string(),
  revisionNumber: z.number().int().nonnegative(),
  source: z.enum([
    'IMPORT',
    'USER_EDIT',
    'AI_ASSISTED',
    'RESTORE',
    'MIGRATION',
  ]),
  createdAt: z.string(),
  title: z.string(),
  isOriginal: z.boolean(),
  summary: z.string(),
  changes: z.array(z.string()),
});

export const recipeRevisionDetailSchema = recipeDetailSchema.extend({
  summary: z.string(),
  changes: z.array(z.string()),
});

export type RecipeEngagementDto = z.infer<typeof recipeEngagementSchema>;
export type RecipeNoteDto = z.infer<typeof recipeNoteSchema>;
export type RecipeDetailDto = z.infer<typeof recipeDetailSchema>;
export type RecipeListItemDto = z.infer<typeof recipeListItemSchema>;
export type RecipeIngredientDto = z.infer<typeof recipeIngredientSchema>;
export type RecipeStepDto = z.infer<typeof recipeStepSchema>;
export type PatchRecipeBody = z.infer<typeof patchRecipeBodySchema>;
export type CategoryDto = z.infer<typeof categorySchema>;
export type RecipeRevisionSummaryDto = z.infer<
  typeof recipeRevisionSummarySchema
>;
export const assignRecipeCategoriesBodySchema = z.object({
  expectedRevisionNumber: z.number().int().nonnegative(),
  categoryIds: z.array(z.string()).min(1),
});

export const assignRecipeCategoriesResponseSchema = z.object({
  recipeId: z.string(),
  revisionNumber: z.number().int().nonnegative(),
  categories: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
    }),
  ),
});

export type RecipeRevisionDetailDto = z.infer<
  typeof recipeRevisionDetailSchema
>;
export type AssignRecipeCategoriesBody = z.infer<
  typeof assignRecipeCategoriesBodySchema
>;
export type AssignRecipeCategoriesResponse = z.infer<
  typeof assignRecipeCategoriesResponseSchema
>;
