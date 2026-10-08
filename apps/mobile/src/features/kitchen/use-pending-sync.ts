import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { flushCollectionUpsert } from '@/features/collections/flush';
import { createPantryItems } from '@/features/pantry/api';
import {
  deleteRecipeFavorite,
  putRecipeFavorite,
  putRecipeReviewState,
} from '@/features/recipes/api';
import { collectionKeys, pantryKeys, recipeKeys } from '@/features/query-keys';
import { pendingAutoFlush } from '@/features/kitchen/pending-sync';
import { isOfflineError } from '@/lib/network';
import { useKitchenStore } from '@/stores/kitchen-store';

export function usePendingSyncFlush() {
  const queryClient = useQueryClient();
  const queue = useKitchenStore((state) => state.pendingSync);
  const flushing = useRef(false);

  const flush = useCallback(async () => {
    if (flushing.current) {
      return;
    }
    const pending = pendingAutoFlush(useKitchenStore.getState().pendingSync);
    if (!pending.length) {
      return;
    }
    flushing.current = true;
    let confirmed = 0;
    try {
      for (const op of pending) {
        try {
          if (op.kind === 'favorite.put') {
            await putRecipeFavorite(op.payload.recipeId);
          } else if (op.kind === 'favorite.delete') {
            await deleteRecipeFavorite(op.payload.recipeId);
          } else if (op.kind === 'review.ready') {
            await putRecipeReviewState(op.payload.recipeId, 'READY');
          } else if (op.kind === 'review.needs_review') {
            await putRecipeReviewState(op.payload.recipeId, 'NEEDS_REVIEW');
          } else if (op.kind === 'pantry.upsert') {
            await createPantryItems([{ name: op.payload.name }]);
          } else if (op.kind === 'collection.upsert') {
            await flushCollectionUpsert(op);
          }
          useKitchenStore.getState().patchPending(op.id, {
            status: 'confirmed',
          });
          confirmed += 1;
        } catch (error) {
          const offline = isOfflineError(error);
          useKitchenStore.getState().patchPending(op.id, {
            status: offline ? 'pending' : 'failed',
            attempts: op.attempts + 1,
            lastError: error instanceof Error ? error.message : 'Sync failed',
          });
        }
      }
      if (confirmed > 0) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: recipeKeys.all }),
          queryClient.invalidateQueries({ queryKey: pantryKeys.all }),
          queryClient.invalidateQueries({ queryKey: collectionKeys.all }),
        ]);
      }
    } finally {
      flushing.current = false;
    }
  }, [queryClient]);

  useEffect(() => {
    void flush();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void flush();
      }
    });
    return () => sub.remove();
  }, [flush, queue.length]);

  return { flush };
}
