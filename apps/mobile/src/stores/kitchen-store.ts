import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_PANTRY_STAPLES } from '@/stores/contracts';
import type { KitchenState } from '@/stores/contracts';

const defaultCollections: KitchenState['collections'] = [
  {
    id: 'sunday',
    name: 'Sunday cooking',
    recipeIds: ['seed:galette', 'seed:harissa', 'seed:dal'],
  },
  {
    id: 'twenty',
    name: '20 minutes flat',
    recipeIds: ['seed:pistachio', 'seed:gnocchi', 'seed:congee'],
  },
  {
    id: 'mum',
    name: 'From Mum',
    recipeIds: ['seed:congee', 'seed:dal', 'seed:harissa'],
  },
  {
    id: 'six',
    name: 'Feeding six',
    recipeIds: ['seed:galette', 'seed:harissa', 'seed:gnocchi'],
  },
];

export const useKitchenStore = create<KitchenState>()(
  persist(
    (set, get) => ({
      inboxStatus: {
        'seed:gnocchi': 'ready',
        'seed:galette': 'needs_review',
      },
      savedIds: ['seed:harissa', 'seed:dal'],
      wantIds: ['seed:congee'],
      cookedCounts: {
        'seed:dal': 2,
        'seed:harissa': 4,
        'seed:congee': 1,
      },
      collections: defaultCollections,
      pantryStaples: [...DEFAULT_PANTRY_STAPLES],
      servingsByRecipe: {},
      recentSearches: ['harissa', 'galette', 'congee', 'one-pan'],
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
      incrementCooked: (id) =>
        set((state) => ({
          cookedCounts: {
            ...state.cookedCounts,
            [id]: (state.cookedCounts[id] ?? 0) + 1,
          },
        })),
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
      addCollection: (name) =>
        set((state) => ({
          collections: [
            ...state.collections,
            {
              id: `col-${Date.now()}`,
              name,
              recipeIds: [],
            },
          ],
        })),
      markStaple: (name) => {
        const key = name.toLowerCase();
        if (get().pantryStaples.includes(key)) {
          return;
        }
        set((state) => ({ pantryStaples: [...state.pantryStaples, key] }));
      },
    }),
    {
      name: 'mise.kitchen.v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
