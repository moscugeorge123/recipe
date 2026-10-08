import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Units = 'metric' | 'imperial';
export type DietKey = 'veg' | 'pesc' | 'gf' | 'df' | 'nut';

/**
 * Device-local preferences shown on Profile and in Cook mode.
 * The API has no endpoints for these yet.
 */
type TortiePrefs = {
  defaultServings: number;
  /** Ingredient amounts, step heat, in-step measurements and grocery amounts. */
  units: Units;
  diet: Partial<Record<DietKey, boolean>>;
  voice: boolean;
  timerAlerts: boolean;
  keepAwake: boolean;
  snappy: boolean;
  set: (patch: Partial<Omit<TortiePrefs, 'set'>>) => void;
};

export const useTortiePrefs = create<TortiePrefs>()(
  persist(
    (set) => ({
      defaultServings: 2,
      units: 'metric',
      diet: { veg: true },
      voice: true,
      timerAlerts: true,
      keepAwake: true,
      snappy: false,
      set: (patch) => set(patch),
    }),
    {
      name: 'tortie-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ set: _set, ...rest }) => rest,
    },
  ),
);
