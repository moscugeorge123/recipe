import {
  collectionDetailSchema,
  collectionSummarySchema,
  deleteCollectionResponseSchema,
} from '@/features/collections/schemas';
import type {
  CollectionDetail,
  CollectionSummary,
} from '@/features/collections/types';
import { paginationMetaSchema } from '@/features/recipes/schemas';
import { apiClient, unwrapCollection, unwrapData } from '@/services/api-client';

export async function listCollections(
  query: { page?: number; pageSize?: number } = {},
  signal?: AbortSignal,
): Promise<{
  items: CollectionSummary[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 100;
  const parsed = await apiClient.get<unknown>(
    `/collections?page=${page}&pageSize=${pageSize}`,
    { signal },
  );
  const { data, meta } = unwrapCollection(parsed);
  paginationMetaSchema.parse(meta);
  return { items: collectionSummarySchema.array().parse(data), meta };
}

export async function getCollection(
  id: string,
  signal?: AbortSignal,
): Promise<CollectionDetail> {
  const parsed = await apiClient.get<unknown>(`/collections/${id}`, { signal });
  return collectionDetailSchema.parse(unwrapData(parsed));
}

export async function createCollection(body: {
  name: string;
  description?: string | null;
  recipeIds?: string[];
}): Promise<CollectionDetail> {
  const parsed = await apiClient.post<unknown>('/collections', body);
  return collectionDetailSchema.parse(unwrapData(parsed));
}

export async function renameCollection(
  id: string,
  body: { name?: string; description?: string | null },
): Promise<CollectionDetail> {
  const parsed = await apiClient.patch<unknown>(`/collections/${id}`, body);
  return collectionDetailSchema.parse(unwrapData(parsed));
}

export async function deleteCollection(
  id: string,
): Promise<{ id: string; deleted: true }> {
  const parsed = await apiClient.delete<unknown>(`/collections/${id}`);
  return deleteCollectionResponseSchema.parse(unwrapData(parsed));
}

export async function addCollectionRecipe(
  collectionId: string,
  recipeId: string,
): Promise<CollectionDetail> {
  const parsed = await apiClient.post<unknown>(
    `/collections/${collectionId}/recipes`,
    { recipeId },
  );
  return collectionDetailSchema.parse(unwrapData(parsed));
}

export async function removeCollectionRecipe(
  collectionId: string,
  recipeId: string,
): Promise<CollectionDetail> {
  const parsed = await apiClient.delete<unknown>(
    `/collections/${collectionId}/recipes/${recipeId}`,
  );
  return collectionDetailSchema.parse(unwrapData(parsed));
}

export async function reorderCollectionRecipes(
  collectionId: string,
  recipeIds: string[],
): Promise<CollectionDetail> {
  const parsed = await apiClient.put<unknown>(
    `/collections/${collectionId}/recipes`,
    { recipeIds },
  );
  return collectionDetailSchema.parse(unwrapData(parsed));
}
