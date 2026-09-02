import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getRecipeNutrition,
  recalculateRecipeNutrition,
} from '@/features/nutrition/api';
import { QUERY_FRESHNESS, nutritionKey } from '@/features/query-keys';
import { networkFirst, persistKeyFor } from '@/features/query-persist';

export { nutritionKey } from '@/features/query-keys';

export function useRecipeNutrition(recipeId: string | undefined) {
  const isApi = !!recipeId && !recipeId.startsWith('seed:');

  return useQuery({
    queryKey: nutritionKey(recipeId ?? ''),
    queryFn: async ({ signal }) => {
      const result = await networkFirst(
        persistKeyFor(nutritionKey(recipeId as string)),
        () => getRecipeNutrition(recipeId as string, signal),
      );
      return { ...result.data, fromCache: result.fromCache };
    },
    enabled: isApi,
    staleTime: QUERY_FRESHNESS.nutrition,
    refetchInterval: (query) =>
      query.state.data?.status === 'PENDING' ? 2000 : false,
  });
}

export function useRecalculateNutrition(recipeId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => recalculateRecipeNutrition(recipeId),
    onSuccess: (data) => {
      client.setQueryData(nutritionKey(recipeId), data);
    },
  });
}
