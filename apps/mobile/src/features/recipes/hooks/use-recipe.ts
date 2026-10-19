import {
  skipToken,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import { QUERY_FRESHNESS, recipeKeys } from '@/features/query-keys';
import { networkFirst, persistKeyFor } from '@/features/query-persist';
import { getRecipe } from '@/features/recipes/api';
import { mapRecipeListItem } from '@/features/recipes/mapper';
import { getSeedRecipe } from '@/features/recipes/seed';
import type { RecipeListItemView, RecipeView } from '@/features/recipes/types';
import { useTortiePrefs } from '@/tortie/prefs-store';

/**
 * Key for a recipe read that has no id yet (a screen mounted before the plan
 * loaded). It must never contain an empty id: a function-less query on
 * `recipeKeys.detail('')` made TanStack log "No queryFn" on every refetch.
 */
export const NO_RECIPE_KEY = [...recipeKeys.all, 'detail', 'none'] as const;

/** How often to ask again while the API is translating a recipe. */
const TRANSLATION_POLL_MS = 3_000;

function peekListItem(
  client: QueryClient,
  id: string,
): RecipeListItemView | undefined {
  const entries = client.getQueriesData({ queryKey: recipeKeys.all });
  for (const [, data] of entries) {
    if (!data || typeof data !== 'object' || !('items' in data)) {
      continue;
    }
    const page = data as { items: RecipeListItemView[] };
    const hit = page.items.find((item) => item.id === id);
    if (hit) {
      return hit;
    }
  }
  return undefined;
}

type UseRecipeOptions = {
  /**
   * Read the recipe exactly as saved, ignoring the user's recipe language. The editor needs this:
   * saving a translated copy would overwrite the original text.
   */
  original?: boolean;
};

/** Engagement the user changes live; kept fresh from the original detail cache. */
function withLiveEngagement(
  translated: RecipeView,
  original: RecipeView | undefined,
): RecipeView {
  if (!original) {
    return translated;
  }
  return {
    ...translated,
    isFavorite: original.isFavorite,
    rating: original.rating,
    ratingAverage: original.ratingAverage,
    ratingCount: original.ratingCount,
    cookCount: original.cookCount,
    reviewState: original.reviewState,
  };
}

export function useRecipe(id: string | undefined, options?: UseRecipeOptions) {
  const client = useQueryClient();
  const recipeLanguage = useTortiePrefs((s) => s.recipeLanguage);
  const language =
    options?.original || recipeLanguage === 'original'
      ? undefined
      : recipeLanguage;
  const seed = id ? getSeedRecipe(id) : undefined;
  const isApi = !!id && !id.startsWith('seed:');
  const listPreview = !seed && id ? peekListItem(client, id) : undefined;
  const queryKey = !id
    ? NO_RECIPE_KEY
    : language
      ? recipeKeys.localized(id, language)
      : recipeKeys.detail(id);

  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const result = await networkFirst(persistKeyFor(queryKey), () =>
        getRecipe(id as string, signal, language),
      );
      return { ...result.data, fromCache: result.fromCache };
    },
    enabled: isApi,
    staleTime: QUERY_FRESHNESS.recipeDetail,
    retry: 1,
    placeholderData: (previous) => previous,
    refetchInterval: (q) =>
      q.state.data?.translation?.status === 'PENDING'
        ? TRANSLATION_POLL_MS
        : false,
  });

  // Reactive view of the original detail cache, where favorite/rating edits land first.
  const originalKey = id ? recipeKeys.detail(id) : NO_RECIPE_KEY;
  const original = useQuery<RecipeView>({
    queryKey: originalKey,
    // Never fetches itself (enabled: false), but it shares a cache entry with
    // the unlocalized read above, so it carries the same fetcher: a refetch
    // must never find a query with no queryFn. Without an id there is nothing
    // to fetch.
    queryFn: id
      ? async ({ signal }) => {
          const result = await networkFirst(persistKeyFor(originalKey), () =>
            getRecipe(id, signal),
          );
          return { ...result.data, fromCache: result.fromCache };
        }
      : skipToken,
    enabled: false,
  });
  const originalIsNewer =
    !!language && original.dataUpdatedAt > query.dataUpdatedAt;

  const fromList = listPreview ? mapRecipeListItem(listPreview) : undefined;

  const fromCache =
    (!!query.data && query.data.fromCache === true) ||
    (!query.data && !!fromList && query.isError);

  const data =
    seed ??
    (query.data && originalIsNewer
      ? withLiveEngagement(query.data, original.data)
      : query.data) ??
    fromList;

  return {
    ...query,
    data,
    isLoading: isApi ? query.isLoading && !fromList : false,
    fromCache,
  };
}
