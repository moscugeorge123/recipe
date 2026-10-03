import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import { QUERY_FRESHNESS, recipeKeys } from '@/features/query-keys';
import { networkFirst, persistKeyFor } from '@/features/query-persist';
import { getRecipe } from '@/features/recipes/api';
import { mapRecipeListItem } from '@/features/recipes/mapper';
import { getSeedRecipe } from '@/features/recipes/seed';
import type { RecipeListItemView } from '@/features/recipes/types';

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

export function useRecipe(id: string | undefined) {
  const client = useQueryClient();
  const seed = id ? getSeedRecipe(id) : undefined;
  const isApi = !!id && !id.startsWith('seed:');
  const listPreview = !seed && id ? peekListItem(client, id) : undefined;

  const query = useQuery({
    queryKey: recipeKeys.detail(id ?? ''),
    queryFn: async ({ signal }) => {
      const result = await networkFirst(
        persistKeyFor(recipeKeys.detail(id as string)),
        () => getRecipe(id as string, signal),
      );
      return { ...result.data, fromCache: result.fromCache };
    },
    enabled: isApi,
    staleTime: QUERY_FRESHNESS.recipeDetail,
    retry: 1,
    placeholderData: (previous) => previous,
  });

  const fromList = listPreview ? mapRecipeListItem(listPreview) : undefined;

  const fromCache =
    (!!query.data && query.data.fromCache === true) ||
    (!query.data && !!fromList && query.isError);

  return {
    ...query,
    data: seed ?? query.data ?? fromList,
    isLoading: isApi ? query.isLoading && !fromList : false,
    fromCache,
  };
}
