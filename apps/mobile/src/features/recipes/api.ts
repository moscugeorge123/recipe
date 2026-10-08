import {
  deleteRecipeResponseSchema,
  assignRecipeCategoriesBodySchema,
  assignRecipeCategoriesResponseSchema,
  categorySchema,
  paginationMetaSchema,
  type AssignRecipeCategoriesResponse,
  type PatchRecipeBody,
  patchRecipeBodySchema,
  recipeDetailSchema,
  recipeEngagementSchema,
  recipeListItemSchema,
  recipeNoteSchema,
  recipeRevisionDetailSchema,
  recipeRevisionSummarySchema,
  type CategoryDto,
  type RecipeEngagementDto,
  type RecipeNoteDto,
  type RecipeRevisionSummaryDto,
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
  sort?: 'latest' | 'engagement';
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
  if (query.sort !== undefined) {
    params.push(`sort=${encodeURIComponent(query.sort)}`);
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
  const parsed = await apiClient.patch<unknown>(
    `/recipes/${id}`,
    patchRecipeBodySchema.parse(body),
    {
      signal,
    },
  );
  const dto = recipeDetailSchema.parse(unwrapData(parsed));
  return mapRecipeDetail(dto);
}

export async function listCategories(
  signal?: AbortSignal,
): Promise<CategoryDto[]> {
  const parsed = await apiClient.get<unknown>('/categories', { signal });
  return categorySchema.array().parse(unwrapCollection(parsed).data);
}

export async function createCategory(name: string): Promise<CategoryDto> {
  const parsed = await apiClient.post<unknown>('/categories', { name });
  return categorySchema.parse(unwrapData(parsed));
}

export async function renameCategory(
  id: string,
  name: string,
): Promise<CategoryDto> {
  const parsed = await apiClient.patch<unknown>(`/categories/${id}`, { name });
  return categorySchema.parse(unwrapData(parsed));
}

export async function deleteCategory(id: string): Promise<void> {
  await apiClient.delete(`/categories/${id}`);
}

export async function putRecipeCategories(
  id: string,
  body: { expectedRevisionNumber: number; categoryIds: string[] },
): Promise<AssignRecipeCategoriesResponse> {
  const parsed = await apiClient.put<unknown>(
    `/recipes/${id}/categories`,
    assignRecipeCategoriesBodySchema.parse(body),
  );
  return assignRecipeCategoriesResponseSchema.parse(unwrapData(parsed));
}

export async function listRecipeRevisions(
  recipeId: string,
  signal?: AbortSignal,
): Promise<RecipeRevisionSummaryDto[]> {
  const parsed = await apiClient.get<unknown>(
    `/recipes/${recipeId}/revisions`,
    { signal },
  );
  return recipeRevisionSummarySchema
    .array()
    .parse(unwrapCollection(parsed).data);
}

export async function getRecipeRevision(
  recipeId: string,
  revisionId: string,
  signal?: AbortSignal,
) {
  const parsed = await apiClient.get<unknown>(
    `/recipes/${recipeId}/revisions/${revisionId}`,
    { signal },
  );
  return recipeRevisionDetailSchema.parse(unwrapData(parsed));
}

export async function restoreRecipeRevision(
  recipeId: string,
  revisionId: string,
  expectedRevisionNumber: number,
): Promise<RecipeView> {
  const parsed = await apiClient.post<unknown>(
    `/recipes/${recipeId}/revisions/${revisionId}/restore`,
    { expectedRevisionNumber },
  );
  return mapRecipeDetail(recipeDetailSchema.parse(unwrapData(parsed)));
}

export async function putRecipeFavorite(
  id: string,
  expectedUpdatedAt?: string,
): Promise<RecipeEngagementDto> {
  const parsed = await apiClient.put<unknown>(`/recipes/${id}/favorite`, {
    ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
  });
  return recipeEngagementSchema.parse(unwrapData(parsed));
}

export async function deleteRecipeFavorite(
  id: string,
  expectedUpdatedAt?: string,
): Promise<RecipeEngagementDto> {
  const suffix = expectedUpdatedAt
    ? `?expectedUpdatedAt=${encodeURIComponent(expectedUpdatedAt)}`
    : '';
  const parsed = await apiClient.delete<unknown>(
    `/recipes/${id}/favorite${suffix}`,
  );
  return recipeEngagementSchema.parse(unwrapData(parsed));
}

export async function putRecipeRating(
  id: string,
  rating: number,
  expectedUpdatedAt?: string,
): Promise<RecipeEngagementDto> {
  const parsed = await apiClient.put<unknown>(`/recipes/${id}/rating`, {
    rating,
    ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
  });
  return recipeEngagementSchema.parse(unwrapData(parsed));
}

export async function deleteRecipeRating(
  id: string,
  expectedUpdatedAt?: string,
): Promise<RecipeEngagementDto> {
  const suffix = expectedUpdatedAt
    ? `?expectedUpdatedAt=${encodeURIComponent(expectedUpdatedAt)}`
    : '';
  const parsed = await apiClient.delete<unknown>(
    `/recipes/${id}/rating${suffix}`,
  );
  return recipeEngagementSchema.parse(unwrapData(parsed));
}

export async function putRecipeReviewState(
  id: string,
  reviewState: 'NEEDS_REVIEW' | 'READY',
  expectedUpdatedAt?: string,
): Promise<RecipeEngagementDto> {
  const parsed = await apiClient.put<unknown>(`/recipes/${id}/review-state`, {
    reviewState,
    ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
  });
  return recipeEngagementSchema.parse(unwrapData(parsed));
}

export async function listRecipeNotes(
  recipeId: string,
  signal?: AbortSignal,
): Promise<RecipeNoteDto[]> {
  const parsed = await apiClient.get<unknown>(`/recipes/${recipeId}/notes`, {
    signal,
  });
  return recipeNoteSchema.array().parse(unwrapCollection(parsed).data);
}

export async function createRecipeNote(
  recipeId: string,
  body: { body: string; cookSessionId?: string | null },
): Promise<RecipeNoteDto> {
  const parsed = await apiClient.post<unknown>(
    `/recipes/${recipeId}/notes`,
    body,
  );
  return recipeNoteSchema.parse(unwrapData(parsed));
}

export async function patchRecipeNote(
  recipeId: string,
  noteId: string,
  body: { body?: string; cookSessionId?: string | null },
): Promise<RecipeNoteDto> {
  const parsed = await apiClient.patch<unknown>(
    `/recipes/${recipeId}/notes/${noteId}`,
    body,
  );
  return recipeNoteSchema.parse(unwrapData(parsed));
}

export async function deleteRecipeNote(
  recipeId: string,
  noteId: string,
): Promise<void> {
  await apiClient.delete(`/recipes/${recipeId}/notes/${noteId}`);
}
