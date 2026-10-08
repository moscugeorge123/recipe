import { z } from 'zod';

import {
  organizePantryResultSchema,
  pantryItemSchema,
} from '@/features/pantry/schemas';
import type {
  OrganizePantryResult,
  OrganizedPantryItem,
  PantryItemView,
} from '@/features/pantry/types';
import { apiClient, unwrapCollection, unwrapData } from '@/services/api-client';

const deleteResponseSchema = z.object({
  id: z.string(),
  deleted: z.literal(true),
});

export async function listPantryItems(
  query: { page?: number; pageSize?: number; category?: string } = {},
  signal?: AbortSignal,
): Promise<{
  items: PantryItemView[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 100;
  const params = [`page=${page}`, `pageSize=${pageSize}`];
  if (query.category) {
    params.push(`category=${encodeURIComponent(query.category)}`);
  }
  const parsed = await apiClient.get<unknown>(`/pantry?${params.join('&')}`, {
    signal,
  });
  const { data, meta } = unwrapCollection(parsed);
  return { items: pantryItemSchema.array().parse(data), meta };
}

export async function organizePantry(
  body: { text: string; locale?: string },
  signal?: AbortSignal,
): Promise<OrganizePantryResult> {
  const parsed = await apiClient.post<unknown>('/pantry/organize', body, {
    signal,
  });
  return organizePantryResultSchema.parse(unwrapData(parsed));
}

export async function createPantryItems(
  items: (Partial<OrganizedPantryItem> & { name: string })[],
): Promise<PantryItemView[]> {
  const parsed = await apiClient.post<unknown>('/pantry/items', { items });
  return pantryItemSchema.array().parse(unwrapData(parsed));
}

export async function patchPantryItem(
  id: string,
  body: {
    name?: string;
    category?: string;
    emoji?: string;
    colorToken?: string;
  },
): Promise<PantryItemView> {
  const parsed = await apiClient.patch<unknown>(`/pantry/items/${id}`, body);
  return pantryItemSchema.parse(unwrapData(parsed));
}

export async function deletePantryItem(
  id: string,
): Promise<{ id: string; deleted: true }> {
  const parsed = await apiClient.delete<unknown>(`/pantry/items/${id}`);
  return deleteResponseSchema.parse(unwrapData(parsed));
}
