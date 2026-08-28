import { useMemo } from 'react';

import { useRecipes } from '@/features/recipes/hooks/use-recipes';
import { mapRecipeListItem } from '@/features/recipes/mapper';
import { SEED_RECIPES } from '@/features/recipes/seed';
import type { RecipeId, RecipeView } from '@/features/recipes/types';
import { isHave } from '@/stores/contracts';
import { useKitchenStore } from '@/stores/kitchen-store';

function mergeCatalog(seed: RecipeView[], api: RecipeView[]): RecipeView[] {
  const apiUrls = new Set(
    api
      .map((recipe) => recipe.originalUrl)
      .filter((url): url is string => !!url),
  );
  const seedKept = seed.filter(
    (recipe) => !recipe.originalUrl || !apiUrls.has(recipe.originalUrl),
  );
  return [...seedKept, ...api];
}

export function useCatalog() {
  const listQuery = useRecipes(1, 50);

  const apiRecipes = useMemo(
    () => (listQuery.data?.items ?? []).map(mapRecipeListItem),
    [listQuery.data?.items],
  );

  const pantryStaples = useKitchenStore((state) => state.pantryStaples);
  const inboxStatus = useKitchenStore((state) => state.inboxStatus);
  const savedIds = useKitchenStore((state) => state.savedIds);
  const wantIds = useKitchenStore((state) => state.wantIds);
  const cookedCounts = useKitchenStore((state) => state.cookedCounts);
  const collections = useKitchenStore((state) => state.collections);

  const recipes = useMemo(
    () => mergeCatalog(SEED_RECIPES, apiRecipes),
    [apiRecipes],
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
      isHave(ing.name, pantryStaples),
    ).length;
    return {
      recipe,
      have,
      total: recipe.ingredients.length,
      gap:
        have === recipe.ingredients.length
          ? 'everything in stock'
          : `buy ${recipe.ingredients
              .filter((ing) => !isHave(ing.name, pantryStaples))
              .slice(0, 2)
              .map((ing) => ing.name.split(',')[0]?.toLowerCase())
              .join(', ')}`,
    };
  });

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
    isApiError: listQuery.isError,
  };
}
