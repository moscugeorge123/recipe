import type { QueryClient } from '@tanstack/react-query';

import {
  cookSessionKeys,
  fetchInProgressCookSession,
} from '@/features/cook-sessions/hooks';
import { listRecipes } from '@/features/recipes/api';
import { recipeKeys } from '@/features/recipes/hooks/use-recipes';
import { queryClient } from '@/lib/query-client';

const HOME_PAGE_SIZE = 50;

/** Starts Home's first queries without waiting for fonts or the tab tree. */
export function prefetchHomeQueries(
  client: QueryClient = queryClient,
): Promise<void> {
  return Promise.all([
    client.prefetchQuery({
      queryKey: recipeKeys.list(1, HOME_PAGE_SIZE),
      queryFn: ({ signal }) =>
        listRecipes({ page: 1, pageSize: HOME_PAGE_SIZE }, signal),
      staleTime: 60_000,
    }),
    client.prefetchQuery({
      queryKey: cookSessionKeys.current,
      queryFn: ({ signal }) => fetchInProgressCookSession(signal),
      staleTime: 15_000,
    }),
  ]).then(() => undefined);
}
