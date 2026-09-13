import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getRecipe,
  listCategories,
  listRecipeRevisions,
  getRecipeRevision,
  patchRecipe,
  putRecipeCategories,
  restoreRecipeRevision,
} from '@/features/recipes/api';
import type { PatchRecipeBody } from '@/features/recipes/schemas';
import type {
  RecipeCategoryView,
  RecipeListItemView,
  RecipeView,
} from '@/features/recipes/types';
import { QUERY_FRESHNESS, recipeKeys } from '@/features/query-keys';
import { useUiStore } from '@/stores/ui-store';

function patchRecipeInCaches(current: unknown, recipe: RecipeView): unknown {
  if (!current || typeof current !== 'object') return current;
  if (
    'items' in current &&
    Array.isArray((current as { items: unknown[] }).items)
  ) {
    const page = current as {
      items: RecipeListItemView[];
      meta: unknown;
      fromCache?: boolean;
    };
    let changed = false;
    const items = page.items.map((item) => {
      if (item.id !== recipe.id) return item;
      changed = true;
      return {
        ...item,
        title: recipe.title,
        description: recipe.description,
        servings: recipe.servings,
        prepTimeMinutes: recipe.prepTimeMinutes ?? item.prepTimeMinutes,
        cookTimeMinutes: recipe.cookTimeMinutes ?? item.cookTimeMinutes,
        totalTimeMinutes: recipe.totalTimeMinutes ?? item.totalTimeMinutes,
        calories: recipe.calories,
        cuisine: recipe.cuisine,
        categories: recipe.categories ?? item.categories,
        ingredientCount: recipe.ingredients?.length ?? item.ingredientCount,
        stepCount: recipe.steps?.length ?? item.stepCount,
        reviewState: recipe.reviewState ?? item.reviewState,
      };
    });
    return changed ? { ...page, items } : current;
  }
  return current;
}

function refreshRecipeCaches(
  client: ReturnType<typeof useQueryClient>,
  recipeId: string,
  recipe: RecipeView,
) {
  client.setQueryData(recipeKeys.detail(recipeId), recipe);
  client.setQueriesData({ queryKey: recipeKeys.all }, (current) =>
    patchRecipeInCaches(current, recipe),
  );
  return Promise.all([
    client.invalidateQueries({
      queryKey: recipeKeys.revisions(recipeId),
      refetchType: 'inactive',
    }),
    client.invalidateQueries({
      queryKey: recipeKeys.categories,
      refetchType: 'inactive',
    }),
  ]);
}

export function useCategories(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: recipeKeys.categories,
    queryFn: ({ signal }) => listCategories(signal),
    enabled: options?.enabled ?? true,
    staleTime: QUERY_FRESHNESS.categories,
    placeholderData: (previous) => previous,
  });
}

function patchCategoriesInCaches(
  client: ReturnType<typeof useQueryClient>,
  recipeId: string,
  categories: RecipeCategoryView[],
  revisionNumber: number,
) {
  client.setQueryData<RecipeView>(recipeKeys.detail(recipeId), (current) =>
    current ? { ...current, categories, revisionNumber } : current,
  );
  client.setQueriesData({ queryKey: recipeKeys.all }, (current: unknown) => {
    if (!current || typeof current !== 'object' || !('items' in current)) {
      return current;
    }
    const page = current as {
      items: ({ id: string } & Partial<RecipeListItemView>)[];
    };
    return {
      ...page,
      items: page.items.map((item) =>
        item.id === recipeId ? { ...item, categories } : item,
      ),
    };
  });
}

export function useAssignRecipeCategories(recipe: RecipeView | undefined) {
  const client = useQueryClient();
  const showToast = useUiStore((state) => state.showToast);

  return useMutation({
    mutationFn: (categoryIds: string[]) => {
      if (!recipe || recipe.origin !== 'api') {
        return Promise.reject(
          new Error('Categories are only saved for imported recipes.'),
        );
      }
      return putRecipeCategories(recipe.id, {
        expectedRevisionNumber: recipe.revisionNumber ?? 0,
        categoryIds,
      });
    },
    onSuccess: (result) => {
      if (!recipe) {
        return;
      }
      const categories = result.categories.map((category, index) => ({
        id: category.id,
        slug: category.slug,
        name: category.name,
        sortOrder: index,
      }));
      patchCategoriesInCaches(
        client,
        recipe.id,
        categories,
        result.revisionNumber,
      );
    },
    onError: () => {
      showToast({
        text: 'Couldn’t update categories. Try again.',
        glyph: '!',
      });
    },
  });
}

export function useSaveRecipe(recipeId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: PatchRecipeBody) => patchRecipe(recipeId, body),
    onSuccess: async (recipe) => {
      await refreshRecipeCaches(client, recipeId, recipe);
    },
  });
}

/** Fresh recipe detail via React Query (conflict reload / rebase). */
export function useFetchRecipe(recipeId: string) {
  const client = useQueryClient();
  return useCallback(
    () =>
      client.fetchQuery({
        queryKey: recipeKeys.detail(recipeId),
        queryFn: ({ signal }) => getRecipe(recipeId, signal),
        staleTime: 0,
      }),
    [client, recipeId],
  );
}

export function useRecipeRevisions(recipeId: string) {
  return useQuery({
    queryKey: recipeKeys.revisions(recipeId),
    queryFn: ({ signal }) => listRecipeRevisions(recipeId, signal),
    enabled: !!recipeId && !recipeId.startsWith('seed:'),
    staleTime: QUERY_FRESHNESS.revisions,
    placeholderData: (previous) => previous,
  });
}

export function useRecipeRevision(recipeId: string, revisionId: string) {
  return useQuery({
    queryKey: recipeKeys.revision(recipeId, revisionId),
    queryFn: ({ signal }) => getRecipeRevision(recipeId, revisionId, signal),
    enabled: !!recipeId && !!revisionId,
    staleTime: QUERY_FRESHNESS.revisions,
    placeholderData: (previous) => previous,
  });
}

export function useRestoreRecipe(recipeId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      revisionId,
      expectedRevisionNumber,
    }: {
      revisionId: string;
      expectedRevisionNumber: number;
    }) => restoreRecipeRevision(recipeId, revisionId, expectedRevisionNumber),
    onSuccess: async (recipe) => {
      await refreshRecipeCaches(client, recipeId, recipe);
    },
  });
}
