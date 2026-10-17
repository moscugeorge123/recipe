import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createMealPlanEntry,
  deleteMealPlanEntry,
  listMealPlan,
  patchMealPlanEntry,
  reorderMealPlan,
} from '@/features/meal-plan/api';
import { groceriesAddedMessage } from '@/features/shopping-list/aisle';
import { toast } from '@/tortie/nav-store';
import {
  MealEntryKind,
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

/** Rows in the cached shopping list (0 when it was never loaded). */
function shoppingCount(client: ReturnType<typeof useQueryClient>): number {
  return (
    client.getQueryData<{ items: unknown[] }>(shoppingListKeys.list())?.items
      .length ?? 0
  );
}

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
    onMutate: () => ({
      before: shoppingCount(client),
    }),
    onSuccess: (_entry, body, ctx) => {
      invalidatePlanAndShop(client);
      if (body.kind !== MealEntryKind.RECIPE) return;
      // The API adds the recipe's ingredients to the list when a meal is
      // planned. Tell the user so the badge change has a visible cause.
      void client
        .refetchQueries({ queryKey: shoppingListKeys.all })
        .then(() => {
          const msg = groceriesAddedMessage(
            shoppingCount(client) - (ctx?.before ?? 0),
          );
          if (msg) toast(msg);
        })
        .catch(() => undefined);
    },
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
