import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect } from 'react';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';

import {
  defaultKitchenMigrationDeps,
  leftoverAfterMigration,
  runKitchenMigration,
} from '@/features/kitchen/migration';
import { pantryKeys, recipeKeys } from '@/features/query-keys';
import { useKitchenStore } from '@/stores/kitchen-store';

let migrating = false;

export async function startKitchenMigration(
  queryClient: QueryClient,
): Promise<void> {
  if (migrating) {
    return;
  }
  if (useKitchenStore.getState().kitchenMigration?.status === 'completed') {
    return;
  }
  migrating = true;
  try {
    const state = useKitchenStore.getState();
    const doc = await runKitchenMigration(
      {
        inboxStatus: state.inboxStatus,
        savedIds: state.savedIds,
        cookedCounts: state.cookedCounts,
        recipeNotes: state.recipeNotes,
        collections: state.collections,
        pantryStaples: state.pantryStaples,
      },
      defaultKitchenMigrationDeps((op) => {
        useKitchenStore.getState().enqueuePending(op);
      }, AsyncStorage),
    );
    const leftovers = leftoverAfterMigration(useKitchenStore.getState(), doc);
    useKitchenStore.getState().applyMigrationLeftovers(leftovers);
    useKitchenStore.getState().setKitchenMigration(doc);
    if (doc.status === 'completed') {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: recipeKeys.all }),
        queryClient.invalidateQueries({ queryKey: pantryKeys.all }),
      ]);
    }
  } finally {
    migrating = false;
  }
}

export function useKitchenMigration() {
  const queryClient = useQueryClient();
  const migration = useKitchenStore((state) => state.kitchenMigration);

  const retry = useCallback(() => {
    void startKitchenMigration(queryClient);
  }, [queryClient]);

  useEffect(() => {
    const unsub = useKitchenStore.persist.onFinishHydration(() => {
      void startKitchenMigration(queryClient);
    });
    if (useKitchenStore.persist.hasHydrated()) {
      void startKitchenMigration(queryClient);
    }
    return unsub;
  }, [queryClient]);

  return { migration, retry };
}
