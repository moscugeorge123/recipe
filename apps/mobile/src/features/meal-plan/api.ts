import {
  deleteMealPlanEntryResponseSchema,
  mealPlanEntrySchema,
} from '@/features/meal-plan/schemas';
import type {
  CreateMealPlanEntryBody,
  MealPlanEntryView,
  PatchMealPlanEntryBody,
  ReorderMealPlanBody,
} from '@/features/meal-plan/types';
import { apiClient, unwrapData } from '@/services/api-client';

export async function listMealPlan(
  query: { from: string; to: string },
  signal?: AbortSignal,
): Promise<MealPlanEntryView[]> {
  const parsed = await apiClient.get<unknown>(
    `/meal-plan?from=${query.from}&to=${query.to}`,
    { signal },
  );
  return mealPlanEntrySchema.array().parse(unwrapData(parsed));
}

export async function createMealPlanEntry(
  body: CreateMealPlanEntryBody,
): Promise<MealPlanEntryView> {
  const parsed = await apiClient.post<unknown>('/meal-plan/entries', body);
  return mealPlanEntrySchema.parse(unwrapData(parsed));
}

export async function patchMealPlanEntry(
  id: string,
  body: PatchMealPlanEntryBody,
): Promise<MealPlanEntryView> {
  const parsed = await apiClient.patch<unknown>(
    `/meal-plan/entries/${id}`,
    body,
  );
  return mealPlanEntrySchema.parse(unwrapData(parsed));
}

export async function deleteMealPlanEntry(
  id: string,
): Promise<{ id: string; deleted: true }> {
  const parsed = await apiClient.delete<unknown>(`/meal-plan/entries/${id}`);
  return deleteMealPlanEntryResponseSchema.parse(unwrapData(parsed));
}

export async function reorderMealPlan(
  body: ReorderMealPlanBody,
): Promise<MealPlanEntryView[]> {
  const parsed = await apiClient.put<unknown>('/meal-plan/reorder', body);
  return mealPlanEntrySchema.array().parse(unwrapData(parsed));
}
