import { z } from 'zod';

import { paginationQuerySchema } from '../../../shared/pagination/pagination.js';

export const recipeIdParamsSchema = z.object({
  id: z.uuid('id must be a UUID'),
});

export const listRecipesQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(200).optional(),
  cuisine: z.string().trim().min(1).max(80).optional(),
  sourceType: z.enum(['INSTAGRAM', 'YOUTUBE', 'FACEBOOK', 'TIKTOK', 'GENERIC_WEB']).optional(),
});

export type ListRecipesQuery = z.infer<typeof listRecipesQuerySchema>;

export const recipeIngredientSchema = z.object({
  id: z.uuid(),
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
  id: z.uuid(),
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
  id: z.uuid(),
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
  id: z.uuid(),
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
  ingredients: z.array(recipeIngredientSchema),
  steps: z.array(recipeStepSchema),
  source: recipeSourceSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const recipeListItemSchema = z.object({
  id: z.uuid(),
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
});

export const deleteRecipeResponseSchema = z.object({
  id: z.uuid(),
  deleted: z.literal(true),
});

const patchRecipeIngredientSchema = z.object({
  name: z.string(),
  canonicalName: z.string().nullable().optional(),
  quantity: z.union([z.string(), z.number()]).nullable().optional(),
  unit: z.string().nullable(),
  preparation: z.string().nullable(),
  optional: z.boolean().default(false),
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
    ingredients: z.array(patchRecipeIngredientSchema),
    steps: z.array(patchRecipeStepSchema),
  })
  .partial()
  .strict();

export type PatchRecipeBody = z.infer<typeof patchRecipeBodySchema>;
