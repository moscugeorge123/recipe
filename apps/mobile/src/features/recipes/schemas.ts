import { z } from 'zod';

export const recipeDifficultySchema = z.enum(['Easy', 'Medium', 'Hard']);

export const recipeIngredientSchema = z.object({
  id: z.string(),
  name: z.string(),
  canonicalName: z.string().nullable(),
  quantity: z.union([z.string(), z.number()]).nullable(),
  unit: z.string().nullable(),
  preparation: z.string().nullable(),
  optional: z.boolean(),
  category: z.string(),
  confidence: z.number(),
  provenance: z.unknown(),
  warnings: z.unknown(),
  sortOrder: z.number().int(),
});

export const recipeStepSchema = z.object({
  id: z.string(),
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
  cuisine: z.string().nullable(),
  difficulty: recipeDifficultySchema.nullable(),
  minutes: z.number().int().nullable(),
  nutrition: z.unknown().nullable(),
  sourceLanguage: z.string().nullable(),
  confidence: z.number(),
  warnings: z.unknown(),
  promptVersion: z.string().nullable(),
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
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  servings: z.number().int().nullable().optional(),
  prepTimeMinutes: z.number().int().nullable().optional(),
  cookTimeMinutes: z.number().int().nullable().optional(),
  totalTimeMinutes: z.number().int().nullable().optional(),
  calories: z.number().int().nullable().optional(),
  cuisine: z.string().nullable().optional(),
  ingredients: z.array(z.unknown()).optional(),
  steps: z.array(z.unknown()).optional(),
});

export type RecipeDetailDto = z.infer<typeof recipeDetailSchema>;
export type RecipeListItemDto = z.infer<typeof recipeListItemSchema>;
export type RecipeIngredientDto = z.infer<typeof recipeIngredientSchema>;
export type RecipeStepDto = z.infer<typeof recipeStepSchema>;
export type PatchRecipeBody = z.infer<typeof patchRecipeBodySchema>;
