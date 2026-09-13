import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createMealPlanEntry,
  deleteMealPlanEntry,
  listMealPlan,
  patchMealPlanEntry,
  reorderMealPlan,
} from '@/features/meal-plan/api';
import {
  sundayOfWeek,
  type CreateMealPlanEntryBody,
  type PatchMealPlanEntryBody,
  type ReorderMealPlanBody,
} from '@/features/meal-plan/types';
import {
  QUERY_FRESHNESS,
  mealPlanKeys,
  shoppingListKeys,
} from '@/features/query-keys';
import { networkFirst, persistKeyFor } from '@/features/query-persist';

export { mealPlanKeys } from '@/features/query-keys';

function invalidatePlanAndShop(
  client: ReturnType<typeof useQueryClient>,
): void {
  client
    .invalidateQueries({ queryKey: mealPlanKeys.all })
    .catch(() => undefined);
  client
    .invalidateQueries({ queryKey: shoppingListKeys.all })
    .catch(() => undefined);
}

export function useMealPlan(weekStart: string) {
  const from = weekStart;
  const to = sundayOfWeek(weekStart);
  const persistKey = persistKeyFor(mealPlanKeys.range(from, to));
  return useQuery({
    queryKey: mealPlanKeys.range(from, to),
    queryFn: async ({ signal }) => {
      const result = await networkFirst(persistKey, () =>
        listMealPlan({ from, to }, signal),
      );
      return {
        items: result.data,
        from,
        to,
        fromCache: result.fromCache,
      };
    },
    staleTime: QUERY_FRESHNESS.mealPlan,
    retry: 1,
    placeholderData: (previous) => previous,
  });
}

export function useCreateMealPlanEntry() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateMealPlanEntryBody) => createMealPlanEntry(body),
    onSuccess: () => invalidatePlanAndShop(client),
  });
}

export function usePatchMealPlanEntry() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PatchMealPlanEntryBody }) =>
      patchMealPlanEntry(id, body),
    onSuccess: () => invalidatePlanAndShop(client),
  });
}

export function useDeleteMealPlanEntry() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMealPlanEntry(id),
    onSuccess: () => invalidatePlanAndShop(client),
  });
}

export function useReorderMealPlan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: ReorderMealPlanBody) => reorderMealPlan(body),
    onSuccess: () => invalidatePlanAndShop(client),
  });
}

export function useClearMealPlanWeek() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await deleteMealPlanEntry(id);
      }
    },
    onSuccess: () => invalidatePlanAndShop(client),
  });
}
