import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useRef } from 'react';

import {
  deleteRecipeFavorite,
  deleteRecipeRating,
  putRecipeFavorite,
  putRecipeRating,
} from '@/features/recipes/api';
import { recipeKeys } from '@/features/query-keys';
import type { RecipeEngagementDto } from '@/features/recipes/schemas';
import type { RecipeView } from '@/features/recipes/types';
import { isMigratableRecipeId } from '@/features/kitchen/ids';
import { hapticLight } from '@/lib/haptics';
import { isOfflineError } from '@/lib/network';
import { enqueueIdempotent, useKitchenStore } from '@/stores/kitchen-store';
import { useUiStore } from '@/stores/ui-store';

function applyEngagement(
  client: QueryClient,
  engagement: Partial<RecipeEngagementDto> & { id: string },
) {
  client.setQueryData<RecipeView>(
    recipeKeys.detail(engagement.id),
    (current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        isFavorite: engagement.isFavorite ?? current.isFavorite,
        rating:
          engagement.rating === undefined ? current.rating : engagement.rating,
        ratingAverage:
          engagement.ratingAverage === undefined
            ? current.ratingAverage
            : engagement.ratingAverage,
        ratingCount: engagement.ratingCount ?? current.ratingCount,
        cookCount: engagement.cookCount ?? current.cookCount,
        reviewState: engagement.reviewState ?? current.reviewState,
      };
    },
  );

  client.setQueriesData({ queryKey: recipeKeys.all }, (current: unknown) => {
    if (!current || typeof current !== 'object' || !('items' in current)) {
      return current;
    }
    const page = current as {
      items: ({ id: string } & Partial<RecipeView>)[];
      meta: unknown;
      fromCache?: boolean;
    };
    return {
      ...page,
      items: page.items.map((item) =>
        item.id === engagement.id
          ? {
              ...item,
              isFavorite: engagement.isFavorite ?? item.isFavorite,
              rating:
                engagement.rating === undefined
                  ? item.rating
                  : engagement.rating,
              cookCount: engagement.cookCount ?? item.cookCount,
              reviewState: engagement.reviewState ?? item.reviewState,
            }
          : item,
      ),
    };
  });
}

export function useRecipeFavorite(recipe: RecipeView | undefined) {
  const client = useQueryClient();
  const showToast = useUiStore((state) => state.showToast);
  const toggleSaved = useKitchenStore((state) => state.toggleSaved);
  const confirmReviewed = useKitchenStore((state) => state.confirmReviewed);
  const savedIds = useKitchenStore((state) => state.savedIds);
  const pending = useRef(false);

  const isFavorite =
    recipe?.origin === 'api'
      ? !!recipe.isFavorite
      : !!recipe && savedIds.includes(recipe.id);

  const mutation = useMutation({
    mutationFn: async (next: boolean) => {
      if (!recipe || recipe.origin !== 'api') {
        return {
          id: recipe?.id ?? '',
          isFavorite: next,
        } as RecipeEngagementDto;
      }
      return next
        ? putRecipeFavorite(recipe.id)
        : deleteRecipeFavorite(recipe.id);
    },
    onMutate: async (next) => {
      if (!recipe) {
        return {};
      }
      const previous = client.getQueryData<RecipeView>(
        recipeKeys.detail(recipe.id),
      );
      applyEngagement(client, { id: recipe.id, isFavorite: next });
      return { previous };
    },
    onError: (error, next, context) => {
      if (isOfflineError(error) && recipe && isMigratableRecipeId(recipe.id)) {
        enqueueIdempotent(next ? 'favorite.put' : 'favorite.delete', recipe.id);
        showToast({
          text: next
            ? 'Saved on this device. We’ll sync when you’re back online.'
            : 'Removed here. We’ll sync when you’re back online.',
          glyph: next ? '♥' : '·',
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
        text: 'Couldn’t update your heart. Try again.',
        glyph: '♡',
      });
    },
    onSuccess: (engagement, next) => {
      if (engagement.userRecipeId) {
        applyEngagement(client, engagement);
      }
      showToast({
        text: next ? 'Saved to your kitchen' : 'Removed from your kitchen',
        glyph: next ? '♥' : '·',
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

  const toggle = () => {
    if (!recipe || pending.current || mutation.isPending) {
      return;
    }
    pending.current = true;
    const next = !isFavorite;
    hapticLight().catch(() => undefined);
    if (recipe.origin !== 'api') {
      if (next) {
        confirmReviewed(recipe.id);
      }
      toggleSaved(recipe.id);
      showToast({
        text: next ? 'Saved to your kitchen' : 'Removed from your kitchen',
        glyph: next ? '♥' : '·',
      });
      pending.current = false;
      return;
    }
    mutation.mutate(next, {
      onSettled: () => {
        pending.current = false;
      },
    });
  };

  return {
    isFavorite,
    toggle,
    isPending: mutation.isPending,
  };
}

export function useRecipeRating(recipe: RecipeView | undefined) {
  const client = useQueryClient();
  const showToast = useUiStore((state) => state.showToast);
  const pending = useRef(false);

  const mutation = useMutation({
    mutationFn: async (next: number | null) => {
      if (!recipe || recipe.origin !== 'api') {
        return {
          id: recipe?.id ?? '',
          rating: next,
          ratingAverage: next,
          ratingCount: next == null ? 0 : 1,
        } as RecipeEngagementDto;
      }
      return next == null
        ? deleteRecipeRating(recipe.id)
        : putRecipeRating(recipe.id, next);
    },
    onMutate: async (next) => {
      if (!recipe) {
        return {};
      }
      const previous = client.getQueryData<RecipeView>(
        recipeKeys.detail(recipe.id),
      );
      applyEngagement(client, {
        id: recipe.id,
        rating: next,
        ratingAverage: next,
        ratingCount: next == null ? 0 : 1,
      });
      return { previous };
    },
    onError: (error, _next, context) => {
      if (isOfflineError(error) && recipe && isMigratableRecipeId(recipe.id)) {
        showToast({
          text: 'Stars saved on this device. We’ll sync when you’re back online.',
          glyph: '☆',
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
        text: 'Couldn’t save your stars. Try again.',
        glyph: '☆',
      });
    },
    onSuccess: (engagement) => {
      if (engagement.userRecipeId) {
        applyEngagement(client, engagement);
      }
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

  const setRating = (value: number) => {
    if (!recipe || pending.current || mutation.isPending) {
      return;
    }
    pending.current = true;
    const next = recipe.rating === value ? null : value;
    hapticLight().catch(() => undefined);
    mutation.mutate(next, {
      onSettled: () => {
        pending.current = false;
      },
    });
  };

  return {
    rating: recipe?.rating ?? null,
    setRating,
    isPending: mutation.isPending,
  };
}

export function invalidateRecipeRankings(client: QueryClient): Promise<void> {
  return client
    .invalidateQueries({ queryKey: recipeKeys.all })
    .then(() => undefined);
}
