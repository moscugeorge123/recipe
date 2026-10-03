import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { putRecipeReviewState } from '@/features/recipes/api';
import { recipeKeys } from '@/features/query-keys';
import type { RecipeEngagementDto } from '@/features/recipes/schemas';
import type { RecipeView } from '@/features/recipes/types';
import { isMigratableRecipeId } from '@/features/kitchen/ids';
import { isOfflineError } from '@/lib/network';
import { enqueueIdempotent, useKitchenStore } from '@/stores/kitchen-store';
import { useUiStore } from '@/stores/ui-store';

function applyReview(
  client: QueryClient,
  patch: { id: string; reviewState: 'NEEDS_REVIEW' | 'READY' },
) {
  client.setQueryData<RecipeView>(recipeKeys.detail(patch.id), (current) =>
    current ? { ...current, reviewState: patch.reviewState } : current,
  );
  client.setQueriesData({ queryKey: recipeKeys.all }, (current: unknown) => {
    if (!current || typeof current !== 'object' || !('items' in current)) {
      return current;
    }
    const page = current as {
      items: ({ id: string } & Partial<RecipeView>)[];
    };
    return {
      ...page,
      items: page.items.map((item) =>
        item.id === patch.id
          ? { ...item, reviewState: patch.reviewState }
          : item,
      ),
    };
  });
}

export function useConfirmReviewed() {
  const client = useQueryClient();
  const showToast = useUiStore((state) => state.showToast);
  const confirmLocal = useKitchenStore((state) => state.confirmReviewed);

  const mutation = useMutation({
    mutationFn: async (recipeId: string) => {
      if (!isMigratableRecipeId(recipeId)) {
        return {
          id: recipeId,
          reviewState: 'READY',
        } as RecipeEngagementDto;
      }
      return putRecipeReviewState(recipeId, 'READY');
    },
    onMutate: async (recipeId) => {
      confirmLocal(recipeId);
      const previous = client.getQueryData<RecipeView>(
        recipeKeys.detail(recipeId),
      );
      applyReview(client, { id: recipeId, reviewState: 'READY' });
      return { previous };
    },
    onError: (error, recipeId, context) => {
      if (isOfflineError(error) && isMigratableRecipeId(recipeId)) {
        enqueueIdempotent('review.ready', recipeId);
        showToast({
          text: 'Marked reviewed. We’ll sync when you’re back online.',
          glyph: '✓',
        });
        return;
      }
      if (context?.previous) {
        client.setQueryData(
          recipeKeys.detail(context.previous.id),
          context.previous,
        );
      }
      showToast({
        text: 'Couldn’t mark this reviewed. Try again.',
        glyph: '!',
      });
    },
    onSettled: (_data, error) => {
      if (error && isOfflineError(error)) {
        return;
      }
      client
        .invalidateQueries({ queryKey: recipeKeys.all })
        .catch(() => undefined);
    },
  });

  return {
    confirm: (recipeId: string) => mutation.mutate(recipeId),
    isPending: mutation.isPending,
  };
}
