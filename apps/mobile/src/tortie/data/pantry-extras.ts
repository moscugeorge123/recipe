import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** 1 Running low · 2 Some left · 3 Plenty. */
export type PantryLevel = 1 | 2 | 3;
export type PantryUnit = 'g' | 'kg' | 'ml' | 'l';

/** Pantry fields the API doesn't model (prototype `pantry[]` lv/items/packs/amt/unit/listed). */
export type PantryExtras = {
  lv: PantryLevel;
  items: number;
  packs: number;
  amt: number | null;
  unit: PantryUnit;
  listed: boolean;
};

type State = {
  /** Overrides keyed by pantry item id; missing fields fall back to the API quantity/unit. */
  by: Record<string, Partial<PantryExtras>>;
  /** Source line overrides for shopping-list rows added from a low pantry tile ("Running low"). */
  notes: Record<string, string>;
  patch: (id: string, p: Partial<PantryExtras>) => void;
  remove: (id: string) => void;
  note: (shopId: string, text: string) => void;
};

/** Device-local pantry details (level, counts, amount overrides, listed flag). */
export const usePantryExtras = create<State>()(
  persist(
    (set) => ({
      by: {},
      notes: {},
      patch: (id, p) =>
        set((s) => ({ by: { ...s.by, [id]: { ...s.by[id], ...p } } })),
      remove: (id) =>
        set((s) => {
          const { [id]: _gone, ...by } = s.by;
          return { by };
        }),
      note: (shopId, text) =>
        set((s) => ({ notes: { ...s.notes, [shopId]: text } })),
    }),
    {
      name: 'tortie-pantry-extras',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ by, notes }) => ({ by, notes }),
    },
  ),
);
