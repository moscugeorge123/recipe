import { useMemo } from 'react';

import {
  catalogRecipes,
  collectionsForCatalog,
  mergeCookedCounts,
  mergeInboxStatus,
  mergeSavedIds,
} from '@/features/catalog/catalog';
import { collectionsFromQueue } from '@/features/kitchen/pending-sync';
import { useCollections } from '@/features/collections/hooks';
import { usePantryItems } from '@/features/pantry/hooks';
import { useRecipes } from '@/features/recipes/hooks/use-recipes';
import { mapRecipeListItem } from '@/features/recipes/mapper';
import type { RecipeId, RecipeView } from '@/features/recipes/types';
import { isHave } from '@/stores/contracts';
import { useKitchenStore } from '@/stores/kitchen-store';

export function useCatalog() {
  const listQuery = useRecipes(1, 50);

  const apiRecipes = useMemo(
    () => (listQuery.data?.items ?? []).map(mapRecipeListItem),
    [listQuery.data?.items],
  );

  const leftoverStaples = useKitchenStore((state) => state.pantryStaples);
  const leftoverCollections = useKitchenStore((state) => state.collections);
  const pendingSync = useKitchenStore((state) => state.pendingSync);
  const migration = useKitchenStore((state) => state.kitchenMigration);
  const migrationComplete = migration?.status === 'completed';
  const collectionsQuery = useCollections();
  const pantryQuery = usePantryItems();
  const pantryKeys = useMemo(() => {
    const fromApi = (pantryQuery.data?.items ?? []).flatMap((item) =>
      [item.canonicalName, item.name].filter(
        (value): value is string => !!value,
      ),
    );
    const local = migrationComplete ? [] : leftoverStaples;
    return [...new Set([...fromApi, ...local])];
  }, [leftoverStaples, migrationComplete, pantryQuery.data?.items]);

  const localInbox = useKitchenStore((state) => state.inboxStatus);
  const localSaved = useKitchenStore((state) => state.savedIds);
  const wantIds = useKitchenStore((state) => state.wantIds);
  const localCooked = useKitchenStore((state) => state.cookedCounts);

  const recipes = useMemo(() => catalogRecipes(apiRecipes), [apiRecipes]);

  const inboxStatus = useMemo(
    () =>
      mergeInboxStatus({
        recipes,
        local: localInbox,
        migrationComplete,
      }),
    [localInbox, migrationComplete, recipes],
  );

  const savedIds = useMemo(
    () =>
      mergeSavedIds({
        recipes,
        local: localSaved,
        migrationComplete,
      }),
    [localSaved, migrationComplete, recipes],
  );

  const cookedCounts = useMemo(
    () => mergeCookedCounts({ recipes, local: localCooked }),
    [localCooked, recipes],
  );

  const collections = useMemo(
    () =>
      collectionsForCatalog({
        leftover: leftoverCollections,
        queued: collectionsFromQueue(pendingSync),
        api: (collectionsQuery.data?.items ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          recipeIds: item.recipeIds,
        })),
        migrationComplete,
      }),
    [
      collectionsQuery.data?.items,
      leftoverCollections,
      migrationComplete,
      pendingSync,
    ],
  );

  const byId = useMemo(() => {
    const map = new Map<RecipeId, RecipeView>();
    recipes.forEach((recipe) => map.set(recipe.id, recipe));
    return map;
  }, [recipes]);

  const get = (id: RecipeId) => byId.get(id);

  const pantryMatches = recipes.map((recipe) => {
    if (recipe.ingredients.length === 0) {
      return {
        recipe,
        have: 0,
        total: recipe.ingredientCount ?? 0,
        gap: 'open recipe for ingredients',
      };
    }

    const have = recipe.ingredients.filter((ing) =>
      isHave(ing.name, pantryKeys, ing.canonicalName),
    ).length;
    return {
      recipe,
      have,
      total: recipe.ingredients.length,
      gap:
        have === recipe.ingredients.length
          ? 'everything in stock'
          : `buy ${recipe.ingredients
              .filter((ing) => !isHave(ing.name, pantryKeys, ing.canonicalName))
              .slice(0, 2)
              .map((ing) => ing.name.split(',')[0]?.toLowerCase())
              .join(', ')}`,
    };
  });

  const fromCache = listQuery.data?.fromCache === true;
  const offline =
    fromCache || (listQuery.isError && (listQuery.data?.items.length ?? 0) > 0);

  return {
    recipes,
    get,
    inbox: recipes.filter((recipe) => inboxStatus[recipe.id]),
    saved: recipes.filter((recipe) => savedIds.includes(recipe.id)),
    want: recipes.filter((recipe) => wantIds.includes(recipe.id)),
    cooked: recipes.filter((recipe) => (cookedCounts[recipe.id] ?? 0) > 0),
    pantryMatches,
    collections,
    inboxStatus,
    savedIds,
    wantIds,
    cookedCounts,
    isApiLoading: listQuery.isLoading,
    isApiError: listQuery.isError && !offline,
    isApiFetching: listQuery.isFetching,
    fromCache: offline,
    syncLabel: offline
      ? 'Showing last saved kitchen. We’ll refresh when you’re back online.'
      : listQuery.isError
        ? 'Couldn’t reach your kitchen. Retry when you have a signal.'
        : null,
    refetch: listQuery.refetch,
  };
}
