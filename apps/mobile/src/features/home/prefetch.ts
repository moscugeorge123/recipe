import type { QueryClient } from '@tanstack/react-query';

import {
  cookSessionKeys,
  fetchInProgressCookSession,
} from '@/features/cook-sessions/hooks';
import { listRecipes } from '@/features/recipes/api';
import {
  HOME_ENGAGEMENT_PAGE_SIZE,
  HOME_LATEST_PAGE_SIZE,
  QUERY_FRESHNESS,
  recipeKeys,
} from '@/features/query-keys';
import { queryClient } from '@/lib/query-client';

const HOME_PAGE_SIZE = 50;

/** Starts Home's first queries without waiting for fonts or the tab tree. */
export function prefetchHomeQueries(
  client: QueryClient = queryClient,
): Promise<void> {
  return Promise.all([
    client.prefetchQuery({
      queryKey: recipeKeys.list(1, HOME_LATEST_PAGE_SIZE, { sort: 'latest' }),
      queryFn: ({ signal }) =>
        listRecipes(
          { page: 1, pageSize: HOME_LATEST_PAGE_SIZE, sort: 'latest' },
          signal,
        ),
      staleTime: QUERY_FRESHNESS.recipesHome,
    }),
    client.prefetchQuery({
      queryKey: recipeKeys.list(1, HOME_ENGAGEMENT_PAGE_SIZE, {
        sort: 'engagement',
      }),
      queryFn: ({ signal }) =>
        listRecipes(
          {
            page: 1,
            pageSize: HOME_ENGAGEMENT_PAGE_SIZE,
            sort: 'engagement',
          },
          signal,
        ),
      staleTime: QUERY_FRESHNESS.recipesHome,
    }),
    client.prefetchQuery({
      queryKey: recipeKeys.list(1, HOME_PAGE_SIZE),
      queryFn: ({ signal }) =>
        listRecipes({ page: 1, pageSize: HOME_PAGE_SIZE }, signal),
      staleTime: QUERY_FRESHNESS.recipesList,
    }),
    client.prefetchQuery({
      queryKey: cookSessionKeys.current,
      queryFn: ({ signal }) => fetchInProgressCookSession(signal),
      staleTime: QUERY_FRESHNESS.cookSessions,
    }),
  ]).then(() => undefined);
}
