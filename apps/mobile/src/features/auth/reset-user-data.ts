import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StoreApi } from 'zustand';

import { QUERY_PERSIST_PREFIX } from '@/features/query-persist';
import { queryClient } from '@/lib/query-client';
import { useCookStore } from '@/stores/cook-store';
import { useKitchenStore } from '@/stores/kitchen-store';
import { useMealPlanWeekStore } from '@/stores/meal-plan-week-store';
import { useShopStore } from '@/stores/shop-store';
import { useCook } from '@/tortie/cook-store';
import { usePantryExtras } from '@/tortie/data/pantry-extras';
import { useRecipeUi } from '@/tortie/data/recipe-ui';
import { useImports } from '@/tortie/import-store';

/**
 * AsyncStorage key prefixes written by feature modules (query cache and
 * offline drafts). All of it belongs to the signed-in account.
 * Device preferences (`mise.prefs.v1`, `tortie-prefs`) are deliberately absent.
 */
const USER_KEY_PREFIXES = [
  QUERY_PERSIST_PREFIX,
  'mise.home.recipes.v1',
  'mise.pantry-draft.v1',
  'mise.recipe-editor-draft.v1',
  'mise.note-draft.v1',
  'mise.kitchen.migration.v1',
];

type PersistedStore<T> = StoreApi<T> & {
  persist: { clearStorage: () => void | Promise<void> };
};

/** Back to the initial state in memory, then drop the persisted copy. */
async function resetPersisted<T>(store: PersistedStore<T>): Promise<void> {
  store.setState(store.getInitialState(), true);
  await store.persist.clearStorage();
}

/**
 * Wipes everything that belongs to the signed-in account: the query cache
 * (memory and disk), offline drafts and the user-scoped persisted stores.
 * Called after sign-out and account deletion so the next account never sees
 * stale data. Never throws; every step is best-effort.
 */
export async function resetUserData(): Promise<void> {
  queryClient.clear();
  // Stops the cook-mode ticker before the session is reset.
  useCookStore.getState().exit();

  const stores: PersistedStore<never>[] = [
    useKitchenStore,
    useShopStore,
    useCookStore,
    useMealPlanWeekStore,
    useCook,
    useImports,
    usePantryExtras,
    useRecipeUi,
  ] as unknown as PersistedStore<never>[];

  await Promise.allSettled([
    ...stores.map((store) => resetPersisted(store)),
    // Loaded on demand: the grocery module pulls in the whole shopping stack,
    // which importing `authService` must not do.
    import('@/tortie/data/groceries').then(({ useGroceryAisles }) =>
      resetPersisted(useGroceryAisles as unknown as PersistedStore<never>),
    ),
    AsyncStorage.getAllKeys().then((keys) =>
      Promise.all(
        keys
          .filter((key) =>
            USER_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)),
          )
          .map((key) => AsyncStorage.removeItem(key)),
      ),
    ),
  ]);
}
