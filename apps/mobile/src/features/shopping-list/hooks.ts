import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QUERY_FRESHNESS, shoppingListKeys } from '@/features/query-keys';
import { networkFirst, persistKeyFor } from '@/features/query-persist';
import {
  addShoppingListFromRecipe,
  clearDoneShoppingList,
  createShoppingListItems,
  deleteShoppingListItem,
  listShoppingList,
  patchShoppingListItem,
} from '@/features/shopping-list/api';
import type { ShoppingListWriteItem } from '@/features/shopping-list/types';

export { shoppingListKeys } from '@/features/query-keys';

export function useShoppingList(done?: boolean) {
  const persistKey = persistKeyFor(shoppingListKeys.list(done));
  return useQuery({
    queryKey: shoppingListKeys.list(done),
    queryFn: async ({ signal }) => {
      const result = await networkFirst(persistKey, () =>
        listShoppingList(
          { page: 1, pageSize: 100, ...(done !== undefined ? { done } : {}) },
          signal,
        ),
      );
      return { ...result.data, fromCache: result.fromCache };
    },
    staleTime: QUERY_FRESHNESS.shoppingList,
    retry: 1,
    placeholderData: (previous) => previous,
  });
}

export function useAddShoppingItems() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (items: ShoppingListWriteItem[]) =>
      createShoppingListItems(items),
    onSuccess: () => {
      client
        .invalidateQueries({ queryKey: shoppingListKeys.all })
        .catch(() => undefined);
    },
  });
}

export function useAddFromRecipe() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { recipeId: string; servings?: number }) =>
      addShoppingListFromRecipe(body),
    onSuccess: () => {
      client
        .invalidateQueries({ queryKey: shoppingListKeys.all })
        .catch(() => undefined);
    },
  });
}

export function usePatchShoppingItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: {
        name?: string;
        quantity?: number | null;
        unit?: string | null;
        done?: boolean;
      };
    }) => patchShoppingListItem(id, body),
    onSuccess: () => {
      client
        .invalidateQueries({ queryKey: shoppingListKeys.all })
        .catch(() => undefined);
    },
  });
}

export function useDeleteShoppingItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteShoppingListItem(id),
    onSuccess: () => {
      client
        .invalidateQueries({ queryKey: shoppingListKeys.all })
        .catch(() => undefined);
    },
  });
}

export function useClearDone() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => clearDoneShoppingList(),
    onSuccess: () => {
      client
        .invalidateQueries({ queryKey: shoppingListKeys.all })
        .catch(() => undefined);
    },
  });
}
