import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Per-recipe servings chosen on the detail / cook intro (prototype `serv{id}`), device-local. */
type RecipeUi = {
  serv: Record<string, number>;
  setServ: (id: string, n: number) => void;
};

export const useRecipeUi = create<RecipeUi>()(
  persist(
    (set) => ({
      serv: {},
      setServ: (id, n) => set((s) => ({ serv: { ...s.serv, [id]: n } })),
    }),
    {
      name: 'tortie-recipe-ui',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ serv }) => ({ serv }),
    },
  ),
);

export const clampServ = (n: number) => Math.max(1, Math.min(12, n));

/** Servings for a recipe (defaults to its base), clamped 1–12. */
export function useServings(
  id: string | null | undefined,
  base: number,
): [number, (n: number) => void] {
  const v = useRecipeUi((s) => (id ? s.serv[id] : undefined));
  const setServ = useRecipeUi((s) => s.setServ);
  const set = useCallback(
    (n: number) => {
      if (id) setServ(id, clampServ(n));
    },
    [id, setServ],
  );
  return [v ?? base, set];
}
