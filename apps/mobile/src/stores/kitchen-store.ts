import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { isMigratableRecipeId, isSeedRecipeId } from '@/features/kitchen/ids';
import {
  PENDING_SYNC_SCHEMA_VERSION,
  upsertPendingOp,
  type PendingSyncOp,
} from '@/features/kitchen/pending-sync';
import { DEFAULT_PANTRY_STAPLES } from '@/stores/contracts';
import type { KitchenState } from '@/stores/contracts';

export const useKitchenStore = create<KitchenState>()(
  persist(
    (set, get) => ({
      inboxStatus: {},
      savedIds: [],
      wantIds: [],
      cookedCounts: {},
      recipeNotes: {},
      collections: [],
      pantryStaples: [...DEFAULT_PANTRY_STAPLES],
      servingsByRecipe: {},
      recentSearches: ['harissa', 'galette', 'congee', 'one-pan'],
      pendingSync: [],
      kitchenMigration: null,
      markInbox: (id, status) =>
        set((state) => ({
          inboxStatus: { ...state.inboxStatus, [id]: status },
        })),
      confirmReviewed: (id) =>
        set((state) => {
          const inboxStatus = { ...state.inboxStatus };
          delete inboxStatus[id];
          const savedIds = state.savedIds.includes(id)
            ? state.savedIds
            : [...state.savedIds, id];
          return { inboxStatus, savedIds };
        }),
      toggleSaved: (id) =>
        set((state) => ({
          savedIds: state.savedIds.includes(id)
            ? state.savedIds.filter((item) => item !== id)
            : [...state.savedIds, id],
        })),
      toggleWant: (id) =>
        set((state) => ({
          wantIds: state.wantIds.includes(id)
            ? state.wantIds.filter((item) => item !== id)
            : [...state.wantIds, id],
        })),
      incrementCooked: (id) => {
        if (!isSeedRecipeId(id)) {
          return;
        }
        set((state) => ({
          cookedCounts: {
            ...state.cookedCounts,
            [id]: (state.cookedCounts[id] ?? 0) + 1,
          },
        }));
      },
      addRecipeNote: (id, text) => {
        const trimmed = text.trim();
        if (!trimmed) {
          return;
        }
        set((state) => ({
          recipeNotes: {
            ...state.recipeNotes,
            [id]: [
              { text: trimmed, cookedAt: Date.now() },
              ...(state.recipeNotes[id] ?? []),
            ],
          },
        }));
      },
      setServings: (id, n) =>
        set((state) => ({
          servingsByRecipe: {
            ...state.servingsByRecipe,
            [id]: Math.min(12, Math.max(1, n)),
          },
        })),
      addRecentSearch: (q) => {
        const trimmed = q.trim();
        if (!trimmed) {
          return;
        }
        set((state) => ({
          recentSearches: [
            trimmed,
            ...state.recentSearches.filter((item) => item !== trimmed),
          ].slice(0, 8),
        }));
      },
      addCollection: (name) => {
        const id = `col-${Date.now()}`;
        const op: PendingSyncOp = {
          id: `ps-col-${id}`,
          schemaVersion: PENDING_SYNC_SCHEMA_VERSION,
          kind: 'collection.upsert',
          status: 'pending',
          attempts: 0,
          createdAt: Date.now(),
          payload: {
            clientId: id,
            name,
            recipeIds: [],
            createdAt: Date.now(),
          },
        };
        set((state) => ({
          collections: [...state.collections, { id, name, recipeIds: [] }],
          pendingSync: upsertPendingOp(state.pendingSync, op),
        }));
      },
      markStaple: (name) => {
        const key = name.toLowerCase();
        if (get().pantryStaples.includes(key)) {
          return;
        }
        const op: PendingSyncOp = {
          id: `ps-pantry-${key}`,
          schemaVersion: PENDING_SYNC_SCHEMA_VERSION,
          kind: 'pantry.upsert',
          status: 'pending',
          attempts: 0,
          createdAt: Date.now(),
          payload: { name: key },
        };
        set((state) => ({
          pantryStaples: [...state.pantryStaples, key],
          pendingSync: upsertPendingOp(state.pendingSync, op),
        }));
      },
      enqueuePending: (op) =>
        set((state) => ({
          pendingSync: upsertPendingOp(state.pendingSync, op),
        })),
      patchPending: (id, patch) =>
        set((state) => ({
          pendingSync: state.pendingSync.map((item) =>
            item.id === id ? ({ ...item, ...patch } as PendingSyncOp) : item,
          ),
        })),
      applyMigrationLeftovers: (patch) => set(patch),
      setKitchenMigration: (doc) => set({ kitchenMigration: doc }),
    }),
    {
      name: 'mise.kitchen.v1',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => {
        const stored =
          persisted && typeof persisted === 'object'
            ? (persisted as Partial<KitchenState>)
            : {};
        return {
          ...current,
          ...stored,
          recipeNotes: stored.recipeNotes ?? {},
          pendingSync: stored.pendingSync ?? [],
          kitchenMigration: stored.kitchenMigration ?? null,
        };
      },
    },
  ),
);

export function enqueueIdempotent(
  kind: PendingSyncOp['kind'],
  recipeOrName: string,
): void {
  if (kind === 'collection.upsert') {
    return;
  }
  const now = Date.now();
  if (kind === 'pantry.upsert') {
    useKitchenStore.getState().enqueuePending({
      id: `ps-pantry-${recipeOrName.toLowerCase()}`,
      schemaVersion: PENDING_SYNC_SCHEMA_VERSION,
      kind,
      status: 'pending',
      attempts: 0,
      createdAt: now,
      payload: { name: recipeOrName },
    });
    return;
  }
  if (!isMigratableRecipeId(recipeOrName)) {
    return;
  }
  useKitchenStore.getState().enqueuePending({
    id: `ps-${kind}-${recipeOrName}`,
    schemaVersion: PENDING_SYNC_SCHEMA_VERSION,
    kind,
    status: 'pending',
    attempts: 0,
    createdAt: now,
    payload: { recipeId: recipeOrName },
  } as PendingSyncOp);
}
