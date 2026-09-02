import type { InboxStatus, KitchenCollection } from '@/stores/contracts';
import type { RecipeId, RecipeView } from '@/features/recipes/types';
import { SEED_RECIPES } from '@/features/recipes/seed';
import { includeDevSeedRecipes, isSeedRecipeId } from '@/features/kitchen/ids';
import type { CollectionUpsertOp } from '@/features/kitchen/pending-sync';

export function demoRecipes(
  includeSeeds = includeDevSeedRecipes(),
): RecipeView[] {
  return includeSeeds ? SEED_RECIPES : [];
}

export function catalogRecipes(
  api: RecipeView[],
  includeSeeds = includeDevSeedRecipes(),
): RecipeView[] {
  const seeds = demoRecipes(includeSeeds);
  const apiIds = new Set(api.map((recipe) => recipe.id));
  return [...seeds.filter((recipe) => !apiIds.has(recipe.id)), ...api];
}

export function reviewToInboxStatus(
  reviewState: RecipeView['reviewState'] | undefined,
): InboxStatus | undefined {
  if (reviewState === 'NEEDS_REVIEW') {
    return 'needs_review';
  }
  return undefined;
}

export function mergeInboxStatus(input: {
  recipes: RecipeView[];
  local: Record<RecipeId, InboxStatus>;
  migrationComplete: boolean;
}): Record<RecipeId, InboxStatus> {
  const fromApi: Record<RecipeId, InboxStatus> = {};
  for (const recipe of input.recipes) {
    if (recipe.origin !== 'api') {
      continue;
    }
    const status = reviewToInboxStatus(recipe.reviewState);
    if (status) {
      fromApi[recipe.id] = status;
    }
  }
  if (input.migrationComplete) {
    const seedLocal = Object.fromEntries(
      Object.entries(input.local).filter(([id]) => isSeedRecipeId(id)),
    ) as Record<RecipeId, InboxStatus>;
    return { ...seedLocal, ...fromApi };
  }
  const localApi = Object.fromEntries(
    Object.entries(input.local).filter(([id]) => !isSeedRecipeId(id)),
  ) as Record<RecipeId, InboxStatus>;
  return { ...fromApi, ...localApi };
}

export function mergeSavedIds(input: {
  recipes: RecipeView[];
  local: RecipeId[];
  migrationComplete: boolean;
}): RecipeId[] {
  const fromApi = input.recipes
    .filter((recipe) => recipe.origin === 'api' && recipe.isFavorite)
    .map((recipe) => recipe.id);
  const local = input.migrationComplete
    ? input.local.filter(isSeedRecipeId)
    : input.local;
  return [...new Set([...fromApi, ...local])];
}

export function mergeCookedCounts(input: {
  recipes: RecipeView[];
  local: Record<RecipeId, number>;
}): Record<RecipeId, number> {
  const counts: Record<RecipeId, number> = {};
  for (const recipe of input.recipes) {
    if (recipe.origin === 'api' && (recipe.cookCount ?? 0) > 0) {
      counts[recipe.id] = recipe.cookCount ?? 0;
    }
  }
  for (const [id, count] of Object.entries(input.local)) {
    if (isSeedRecipeId(id) && count > 0) {
      counts[id] = count;
    }
  }
  return counts;
}

export function collectionsForCatalog(input: {
  leftover: KitchenCollection[];
  queued: CollectionUpsertOp['payload'][];
  api?: KitchenCollection[];
  migrationComplete: boolean;
}): KitchenCollection[] {
  const api = input.api ?? [];
  const apiNames = new Set(api.map((item) => item.name.trim().toLowerCase()));
  const fromQueue: KitchenCollection[] = input.queued
    .filter((item) => !apiNames.has(item.name.trim().toLowerCase()))
    .map((item) => ({
      id: item.clientId,
      name: item.name,
      recipeIds: item.recipeIds,
    }));
  if (input.migrationComplete) {
    return [...api, ...fromQueue];
  }
  const knownIds = new Set([
    ...fromQueue.map((item) => item.id),
    ...api.map((item) => item.id),
  ]);
  return [
    ...api,
    ...input.leftover.filter((item) => !knownIds.has(item.id)),
    ...fromQueue,
  ];
}
