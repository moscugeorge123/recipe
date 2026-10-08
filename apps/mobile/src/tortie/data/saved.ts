import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useCallback } from 'react';

import { isMigratableRecipeId } from '@/features/kitchen/ids';
import { recipeKeys } from '@/features/query-keys';
import {
  deleteRecipeFavorite,
  putRecipeFavorite,
} from '@/features/recipes/api';
import type { RecipeView } from '@/features/recipes/types';
import { isOfflineError } from '@/lib/network';
import { enqueueIdempotent } from '@/stores/kitchen-store';
import { toast, useNav } from '@/tortie/nav-store';

function patchFavorite(client: QueryClient, id: string, isFavorite: boolean) {
  client.setQueryData<RecipeView>(recipeKeys.detail(id), (cur) =>
    cur ? { ...cur, isFavorite } : cur,
  );
  client.setQueriesData({ queryKey: recipeKeys.all }, (cur: unknown) => {
    if (!cur || typeof cur !== 'object' || !('items' in cur)) return cur;
    const page = cur as { items: { id: string; isFavorite?: boolean }[] };
    return {
      ...page,
      items: page.items.map((it) =>
        it.id === id ? { ...it, isFavorite } : it,
      ),
    };
  });
}

/**
 * Saved = API favourite (prototype `toggleSave`). Optimistic across the list and
 * detail caches. Toasts "Saved · find it in Cookbook › Saved" / "Removed from Saved",
 * except on the Cookbook tab with no recipe pushed.
 *
 * `useRecipeFavorite` isn't used because it posts its own toast copy through the
 * ui-store bridge ("Saved to your kitchen"), which the design doesn't have.
 */
export function useToggleSave() {
  const client = useQueryClient();
  const { mutate } = useMutation({
    mutationFn: ({ id, next }: { id: string; next: boolean }) =>
      next ? putRecipeFavorite(id) : deleteRecipeFavorite(id),
    onMutate: ({ id, next }) => patchFavorite(client, id, next),
    onError: (error, { id, next }) => {
      if (isOfflineError(error) && isMigratableRecipeId(id)) {
        enqueueIdempotent(next ? 'favorite.put' : 'favorite.delete', id);
        return;
      }
      patchFavorite(client, id, !next);
      toast('Couldn’t update Saved. Try again.');
    },
    onSettled: (_d, error) => {
      if (error && isOfflineError(error)) return;
      client
        .invalidateQueries({ queryKey: recipeKeys.all })
        .catch(() => undefined);
    },
  });
  return useCallback(
    (id: string, next: boolean) => {
      const s = useNav.getState();
      if (!(s.tab === 'cookbook' && !s.detailOpen))
        toast(
          next ? 'Saved · find it in Cookbook › Saved' : 'Removed from Saved',
        );
      mutate({ id, next });
    },
    [mutate],
  );
}
