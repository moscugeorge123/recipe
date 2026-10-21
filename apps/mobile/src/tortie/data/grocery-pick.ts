import type { QueryClient } from '@tanstack/react-query';

import { recipeKeys } from '@/features/query-keys';
import { getRecipe } from '@/features/recipes/api';
import type { MeasurementSystem, RecipeView } from '@/features/recipes/types';
import { ingredientAmount } from '@/features/recipes/units';
import { openingServings, useRecipeUi } from '@/tortie/data/recipe-ui';
import type { BulkRecipe } from '@/tortie/data/selection';
import { toast, useNav } from '@/tortie/nav-store';
import { useTortiePrefs } from '@/tortie/prefs-store';
import { tNow } from '@/i18n/format';

function scaledIngredient(
  view: RecipeView,
  units: MeasurementSystem,
  servings: number | undefined,
): BulkRecipe {
  const base = view.servings ?? 0;
  const scale = servings != null && base > 0 ? servings / base : 1;
  return {
    id: view.id,
    title: view.title,
    ings: view.ingredients.map((ing) => {
      const amount = ingredientAmount(ing, units);
      return {
        n: [ing.name, ing.preparation].filter(Boolean).join(', '),
        q: amount.quantity == null ? null : amount.quantity * scale,
        u: amount.unit,
        category: ing.category,
        emoji: ing.emoji,
      };
    }),
  };
}

export async function loadBulkRecipes(
  client: QueryClient,
  ids: string[],
  opts?: {
    units?: MeasurementSystem;
    servings?: Record<string, number>;
    /** Servings for a recipe the user hasn't picked a count for. */
    defaultServings?: number;
  },
): Promise<{ recipes: BulkRecipe[]; failed: boolean }> {
  const units = opts?.units ?? 'metric';
  const servings = opts?.servings ?? {};
  const recipes: BulkRecipe[] = [];
  let failed = false;
  for (const id of ids) {
    const cached = client.getQueryData<RecipeView>(recipeKeys.detail(id));
    let view = cached && Array.isArray(cached.ingredients) ? cached : null;
    if (!view) {
      try {
        view = await getRecipe(id);
        client.setQueryData(recipeKeys.detail(id), view);
      } catch {
        view = null;
        failed = true;
      }
    }
    if (!view) continue;
    recipes.push(
      scaledIngredient(
        view,
        units,
        openingServings(
          servings[view.id],
          opts?.defaultServings,
          view.servings ?? 0,
        ),
      ),
    );
  }
  return { recipes, failed };
}

function hasNamedIngredient(recipe: BulkRecipe): boolean {
  return recipe.ings.some((ing) => (ing.n.split(',')[0] ?? '').length > 0);
}

/**
 * Load the recipes and open the ingredient picker.
 * Returns true when the sheet opened.
 */
export async function presentGroceryPick(
  client: QueryClient,
  recipeIds: string[],
  opts?: { markWeekMonday?: string | null; onlyMissing?: boolean },
): Promise<boolean> {
  const ids = [...new Set(recipeIds)];
  if (!ids.length) {
    toast(tNow('groceries.noIngredientsToAdd'));
    return false;
  }
  const { recipes, failed } = await loadBulkRecipes(client, ids, {
    units: useTortiePrefs.getState().units,
    servings: useRecipeUi.getState().serv,
    defaultServings: useTortiePrefs.getState().defaultServings,
  });
  const picked = recipes.filter(hasNamedIngredient);
  if (!picked.length) {
    toast(
      failed
        ? tNow('common.couldntAddToGroceries')
        : tNow('groceries.noIngredientsToAdd'),
    );
    return false;
  }
  useNav.getState().openGroceryPick({
    recipes: picked,
    markWeekMonday: opts?.markWeekMonday ?? null,
    ...(opts?.onlyMissing ? { onlyMissing: true } : {}),
  });
  return true;
}
