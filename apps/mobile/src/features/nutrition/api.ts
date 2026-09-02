import { nutritionViewSchema } from '@/features/nutrition/schemas';
import type { NutritionView } from '@/features/nutrition/types';
import { apiClient, unwrapData } from '@/services/api-client';

export async function getRecipeNutrition(
  recipeId: string,
  signal?: AbortSignal,
): Promise<NutritionView> {
  const parsed = await apiClient.get<unknown>(
    `/recipes/${recipeId}/nutrition`,
    {
      signal,
    },
  );
  return nutritionViewSchema.parse(unwrapData(parsed));
}

export async function recalculateRecipeNutrition(
  recipeId: string,
  signal?: AbortSignal,
): Promise<NutritionView> {
  const parsed = await apiClient.post<unknown>(
    `/recipes/${recipeId}/nutrition/recalculate`,
    undefined,
    { signal },
  );
  return nutritionViewSchema.parse(unwrapData(parsed));
}

export async function correctNutritionMatch(
  recipeId: string,
  body: { ingredientId: string; fdcId: string },
): Promise<NutritionView> {
  const parsed = await apiClient.patch<unknown>(
    `/recipes/${recipeId}/nutrition/matches`,
    body,
  );
  return nutritionViewSchema.parse(unwrapData(parsed));
}
