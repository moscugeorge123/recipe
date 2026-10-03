import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QUERY_FRESHNESS, pantryKeys } from '@/features/query-keys';
import { networkFirst, persistKeyFor } from '@/features/query-persist';
import {
  createPantryItems,
  deletePantryItem,
  listPantryItems,
  organizePantry,
  patchPantryItem,
} from '@/features/pantry/api';
import type { OrganizedPantryItem } from '@/features/pantry/types';

export { pantryKeys } from '@/features/query-keys';

export function usePantryItems(category?: string) {
  const persistKey = persistKeyFor(pantryKeys.list(category));
  return useQuery({
    queryKey: pantryKeys.list(category),
    queryFn: async ({ signal }) => {
      const result = await networkFirst(persistKey, () =>
        listPantryItems(
          { page: 1, pageSize: 100, ...(category ? { category } : {}) },
          signal,
        ),
      );
      return { ...result.data, fromCache: result.fromCache };
    },
    staleTime: QUERY_FRESHNESS.pantry,
    retry: 1,
    placeholderData: (previous) => previous,
  });
}

export function useOrganizePantry() {
  return useMutation({
    mutationFn: (body: { text: string; locale?: string }) =>
      organizePantry(body),
  });
}

export function useSavePantryItems() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (items: (Partial<OrganizedPantryItem> & { name: string })[]) =>
      createPantryItems(items),
    onSuccess: () => {
      client
        .invalidateQueries({ queryKey: pantryKeys.all })
        .catch(() => undefined);
    },
  });
}

export function usePatchPantryItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { name?: string; category?: string };
    }) => patchPantryItem(id, body),
    onSuccess: () => {
      client
        .invalidateQueries({ queryKey: pantryKeys.all })
        .catch(() => undefined);
    },
  });
}

export function useDeletePantryItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePantryItem(id),
    onSuccess: () => {
      client
        .invalidateQueries({ queryKey: pantryKeys.all })
        .catch(() => undefined);
    },
  });
}
