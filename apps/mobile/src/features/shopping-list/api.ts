import { paginationMetaSchema } from '@/features/recipes/schemas';
import {
  clearDoneShoppingListResponseSchema,
  deleteShoppingListItemResponseSchema,
  shoppingListItemSchema,
} from '@/features/shopping-list/schemas';
import type {
  ShoppingListItemView,
  ShoppingListWriteItem,
} from '@/features/shopping-list/types';
import { apiClient, unwrapCollection, unwrapData } from '@/services/api-client';

export async function listShoppingList(
  query: { page?: number; pageSize?: number; done?: boolean } = {},
  signal?: AbortSignal,
): Promise<{
  items: ShoppingListItemView[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 100;
  const params = [`page=${page}`, `pageSize=${pageSize}`];
  if (query.done !== undefined) {
    params.push(`done=${query.done ? 'true' : 'false'}`);
  }
  const parsed = await apiClient.get<unknown>(
    `/shopping-list?${params.join('&')}`,
    { signal },
  );
  const { data, meta } = unwrapCollection(parsed);
  paginationMetaSchema.parse(meta);
  return { items: shoppingListItemSchema.array().parse(data), meta };
}

export async function createShoppingListItems(
  items: ShoppingListWriteItem[],
): Promise<ShoppingListItemView[]> {
  const parsed = await apiClient.post<unknown>('/shopping-list/items', {
    items,
  });
  return shoppingListItemSchema.array().parse(unwrapData(parsed));
}

export async function addShoppingListFromRecipe(body: {
  recipeId: string;
  servings?: number;
}): Promise<ShoppingListItemView[]> {
  const parsed = await apiClient.post<unknown>(
    '/shopping-list/from-recipe',
    body,
  );
  return shoppingListItemSchema.array().parse(unwrapData(parsed));
}

export async function patchShoppingListItem(
  id: string,
  body: {
    name?: string;
    quantity?: number | null;
    unit?: string | null;
    done?: boolean;
  },
): Promise<ShoppingListItemView> {
  const parsed = await apiClient.patch<unknown>(
    `/shopping-list/items/${id}`,
    body,
  );
  return shoppingListItemSchema.parse(unwrapData(parsed));
}

export async function deleteShoppingListItem(
  id: string,
): Promise<{ id: string; deleted: true }> {
  const parsed = await apiClient.delete<unknown>(`/shopping-list/items/${id}`);
  return deleteShoppingListItemResponseSchema.parse(unwrapData(parsed));
}

export async function clearDoneShoppingList(): Promise<{
  deleted: true;
  count: number;
}> {
  const parsed = await apiClient.post<unknown>('/shopping-list/clear-done');
  return clearDoneShoppingListResponseSchema.parse(unwrapData(parsed));
}
