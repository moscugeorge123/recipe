/**
 * Canonical TanStack Query key map.
 *
 * Feature modules import these factories instead of minting parallel prefixes.
 * Existing hook files re-export the same objects so current call sites stay valid.
 *
 * | Area            | Key factory                         | Example                                         | Freshness      |
 * |-----------------|-------------------------------------|-------------------------------------------------|----------------|
 * | Recipes list    | `recipeKeys.list(page, size, f)`    | `['recipes', 1, 8, { sort: 'latest' }]`         | 60s / 30s home |
 * | Recipe detail   | `recipeKeys.detail(id)`             | `['recipes', 'detail', id]`                     | 60s            |
 * | Categories      | `recipeKeys.categories`             | `['recipe-categories']`                         | 5m             |
 * | Revisions       | `recipeKeys.revisions(id)`          | `['recipes', 'detail', id, 'revisions']`        | 60s            |
 * | Revision detail | `recipeKeys.revision(id, rev)`      | `['recipes', 'detail', id, 'revisions', rev]`   | 60s            |
 * | Notes           | `recipeKeys.notes(id)`              | `['recipes', 'detail', id, 'notes']`            | 15s            |
 * | Pantry          | `pantryKeys.list(category?)`        | `['pantry', 'list', 'all']`                     | 15s            |
 * | Shopping list   | `shoppingListKeys.list(done?)`      | `['shopping-list', 'list', 'all']`              | 15s            |
 * | Meal plan       | `mealPlanKeys.range(from, to)`      | `['meal-plan', 'range', from, to]`              | 15s            |
 * | Cook sessions   | `cookSessionKeys.list(query)`       | `['cook-sessions', 'list', query]`              | 15s            |
 * | Current cook    | `cookSessionKeys.current`           | `['cook-sessions', 'current']`                  | 15s            |
 * | Collections     | `collectionKeys.list`               | `['collections', 'list']`                       | 30s, Agent 9   |
 * | Profile         | `profileKeys.current`               | `['profile', 'current']`                        | 5m             |
 *
 * Invalidation: favorite/rating/review/cook completion, and a saved import → `recipeKeys.all`.
 * Pantry writes → `pantryKeys.all`. Shopping-list writes → `shoppingListKeys.all`.
 * Meal-plan writes → `mealPlanKeys.all` and `shoppingListKeys.all`.
 * Do not add a second `kitchen.*` tree.
 *
 * Recipe detail GET budget (Agent 8): `/recipes/:id`, `/pantry` (one list),
 * deferred `/notes`, and `/categories` only when editing chips. Never fan out per ingredient, note, or category.
 */
import type { ListCookSessionsQuery } from '@/features/cook-sessions/types';

export type RecipeListFilters = {
  q?: string;
  cuisine?: string;
  sourceType?: string;
  sort?: 'latest' | 'engagement';
};

export const recipeKeys = {
  all: ['recipes'] as const,
  detail: (id: string) => [...recipeKeys.all, 'detail', id] as const,
  list: (page: number, pageSize: number, filters?: RecipeListFilters) =>
    [...recipeKeys.all, page, pageSize, filters] as const,
  categories: ['recipe-categories'] as const,
  revisions: (id: string) => [...recipeKeys.detail(id), 'revisions'] as const,
  revision: (id: string, revisionId: string) =>
    [...recipeKeys.revisions(id), revisionId] as const,
  notes: (id: string) => [...recipeKeys.detail(id), 'notes'] as const,
};

export const HOME_LATEST_PAGE_SIZE = 8;
export const HOME_ENGAGEMENT_PAGE_SIZE = 12;

export const pantryKeys = {
  all: ['pantry'] as const,
  list: (category?: string) =>
    [...pantryKeys.all, 'list', category ?? 'all'] as const,
};

export const shoppingListKeys = {
  all: ['shopping-list'] as const,
  list: (done?: boolean) =>
    [
      ...shoppingListKeys.all,
      'list',
      done === undefined ? 'all' : done,
    ] as const,
};

export const mealPlanKeys = {
  all: ['meal-plan'] as const,
  range: (from: string, to: string) =>
    [...mealPlanKeys.all, 'range', from, to] as const,
};

const cookSessionRoot = ['cook-sessions'] as const;

export const cookSessionKeys = {
  all: cookSessionRoot,
  list: (query: ListCookSessionsQuery) =>
    [...cookSessionRoot, 'list', query] as const,
  current: [...cookSessionRoot, 'current'] as const,
  detail: (id: string) => [...cookSessionRoot, 'detail', id] as const,
};

export const collectionKeys = {
  all: ['collections'] as const,
  list: ['collections', 'list'] as const,
  detail: (id: string) => ['collections', 'detail', id] as const,
};

export const profileKeys = {
  all: ['profile'] as const,
  current: ['profile', 'current'] as const,
};

export const QUERY_FRESHNESS = {
  recipesList: 60_000,
  recipesHome: 30_000,
  recipeDetail: 60_000,
  recipeSearch: 30_000,
  categories: 5 * 60_000,
  notes: 15_000,
  revisions: 60_000,
  pantry: 15_000,
  shoppingList: 15_000,
  mealPlan: 15_000,
  cookSessions: 15_000,
  collections: 30_000,
  profile: 5 * 60_000,
} as const;
