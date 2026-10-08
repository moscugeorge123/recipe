import type { QueryClient } from '@tanstack/react-query';

import {
  cookSessionKeys,
  fetchInProgressCookSession,
} from '@/features/cook-sessions/hooks';
import { listRecipes } from '@/features/recipes/api';
import { QUERY_FRESHNESS, recipeKeys } from '@/features/query-keys';
import { queryClient } from '@/lib/query-client';

const RECIPES_PAGE_SIZE = 50;

/** Starts Recipes-tab queries without waiting for fonts or the tab tree. */
export function prefetchHomeQueries(
  client: QueryClient = queryClient,
): Promise<void> {
  return Promise.all([
    client.prefetchQuery({
      queryKey: recipeKeys.list(1, RECIPES_PAGE_SIZE, { sort: 'latest' }),
      queryFn: ({ signal }) =>
        listRecipes(
          { page: 1, pageSize: RECIPES_PAGE_SIZE, sort: 'latest' },
          signal,
        ),
      staleTime: QUERY_FRESHNESS.recipesList,
    }),
    client.prefetchQuery({
      queryKey: cookSessionKeys.current,
      queryFn: ({ signal }) => fetchInProgressCookSession(signal),
      staleTime: QUERY_FRESHNESS.cookSessions,
    }),
  ]).then(() => undefined);
}
