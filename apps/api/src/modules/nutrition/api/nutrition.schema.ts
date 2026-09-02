import { z } from 'zod';

import { dbUuid } from '../../../shared/validation/uuid.js';

const nutritionValuesSchema = z.object({
  calories: z.number().optional(),
  proteinGrams: z.number().optional(),
  carbohydrateGrams: z.number().optional(),
  fatGrams: z.number().optional(),
  saturatedFatGrams: z.number().optional(),
  fiberGrams: z.number().optional(),
  sugarGrams: z.number().optional(),
  sodiumMilligrams: z.number().optional(),
});

export const nutritionMatchSchema = z.object({
  id: dbUuid(),
  revisionIngredientId: dbUuid().nullable(),
  query: z.string(),
  matchedFoodId: z.string().nullable(),
  matchedFoodName: z.string().nullable(),
  confidence: z.number().nullable(),
  grams: z.number().nullable(),
  nutrients: nutritionValuesSchema.nullable(),
});

export const nutritionViewSchema = z.object({
  recipeId: dbUuid(),
  revisionId: dbUuid(),
  snapshotId: dbUuid().nullable(),
  status: z.enum(['READY', 'PARTIAL', 'UNAVAILABLE', 'PENDING', 'FAILED']),
  calculationStatus: z
    .enum(['NOT_REQUESTED', 'PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED'])
    .nullable(),
  updating: z.boolean(),
  provider: z.string().nullable(),
  calculatedAt: z.iso.datetime().nullable(),
  servings: z.number().nullable(),
  coverage: z.object({
    matched: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    percent: z.number(),
  }),
  unmatchedIngredients: z.array(z.string()),
  totals: nutritionValuesSchema.nullable(),
  perPortion: nutritionValuesSchema.nullable(),
  per100g: nutritionValuesSchema.nullable(),
  matches: z.array(nutritionMatchSchema),
  failureReason: z.string().nullable(),
});

export const correctNutritionMatchBodySchema = z
  .object({
    ingredientId: dbUuid('ingredientId must be a UUID'),
    fdcId: z.string().trim().min(1).max(64),
  })
  .strict();

export type CorrectNutritionMatchBody = z.infer<typeof correctNutritionMatchBodySchema>;
