import { z } from 'zod';

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

export const nutritionViewSchema = z.object({
  recipeId: z.string(),
  revisionId: z.string(),
  snapshotId: z.string().nullable(),
  status: z.enum(['READY', 'PARTIAL', 'UNAVAILABLE', 'PENDING', 'FAILED']),
  calculationStatus: z.string().nullable(),
  updating: z.boolean(),
  provider: z.string().nullable(),
  calculatedAt: z.string().nullable(),
  servings: z.number().nullable(),
  coverage: z.object({
    matched: z.number(),
    total: z.number(),
    percent: z.number(),
  }),
  unmatchedIngredients: z.array(z.string()),
  totals: nutritionValuesSchema.nullable(),
  perPortion: nutritionValuesSchema.nullable(),
  per100g: nutritionValuesSchema.nullable(),
  matches: z.array(
    z.object({
      id: z.string(),
      revisionIngredientId: z.string().nullable(),
      query: z.string(),
      matchedFoodId: z.string().nullable(),
      matchedFoodName: z.string().nullable(),
      confidence: z.number().nullable(),
      grams: z.number().nullable(),
      nutrients: nutritionValuesSchema.nullable(),
    }),
  ),
  failureReason: z.string().nullable(),
});
