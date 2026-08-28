import {
  deleteRecipeResponseSchema,
  paginationMetaSchema,
  type PatchRecipeBody,
  recipeDetailSchema,
  recipeListItemSchema,
} from '@/features/recipes/schemas';
import { mapRecipeDetail } from '@/features/recipes/mapper';
import type { RecipeListItemView, RecipeView } from '@/features/recipes/types';
import { apiClient, unwrapCollection, unwrapData } from '@/services/api-client';

export type ListRecipesQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  cuisine?: string;
  sourceType?: string;
};

function listRecipesPath(query: ListRecipesQuery): string {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const params = [`page=${page}`, `pageSize=${pageSize}`];
  if (query.q !== undefined) {
    params.push(`q=${encodeURIComponent(query.q)}`);
  }
  if (query.cuisine !== undefined) {
    params.push(`cuisine=${encodeURIComponent(query.cuisine)}`);
  }
  if (query.sourceType !== undefined) {
    params.push(`sourceType=${encodeURIComponent(query.sourceType)}`);
  }
  return `/recipes?${params.join('&')}`;
}

export async function listRecipes(
  query: ListRecipesQuery = {},
  signal?: AbortSignal,
): Promise<{
  items: RecipeListItemView[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}> {
  const parsed = await apiClient.get<unknown>(listRecipesPath(query), {
    signal,
  });
  const { data, meta } = unwrapCollection(parsed);
  const items = recipeListItemSchema.array().parse(data);
  paginationMetaSchema.parse(meta);
  return { items, meta };
}

export async function getRecipe(
  id: string,
  signal?: AbortSignal,
): Promise<RecipeView> {
  const parsed = await apiClient.get<unknown>(`/recipes/${id}`, { signal });
  const dto = recipeDetailSchema.parse(unwrapData(parsed));
  return mapRecipeDetail(dto);
}

export async function deleteRecipe(
  id: string,
  signal?: AbortSignal,
): Promise<{ id: string; deleted: true }> {
  const parsed = await apiClient.delete<unknown>(`/recipes/${id}`, { signal });
  return deleteRecipeResponseSchema.parse(unwrapData(parsed));
}

export async function patchRecipe(
  id: string,
  body: PatchRecipeBody,
  signal?: AbortSignal,
): Promise<RecipeView> {
  const parsed = await apiClient.patch<unknown>(`/recipes/${id}`, body, {
    signal,
  });
  const dto = recipeDetailSchema.parse(unwrapData(parsed));
  return mapRecipeDetail(dto);
}
