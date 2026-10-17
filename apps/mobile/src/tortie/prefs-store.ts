import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AppLanguagePref, RecipeLanguagePref } from '@/i18n/languages';

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
  /** Language of the app's own menus and messages; 'system' follows the device. */
  appLanguage: AppLanguagePref;
  /** Language recipes are shown in; 'original' keeps each recipe as saved. */
  recipeLanguage: RecipeLanguagePref;
  voice: boolean;
  timerAlerts: boolean;
  keepAwake: boolean;
  snappy: boolean;
  /** The first-run tour was finished or skipped on this device. */
  welcomed: boolean;
  set: (patch: Partial<Omit<TortiePrefs, 'set'>>) => void;
};

export const useTortiePrefs = create<TortiePrefs>()(
  persist(
    (set) => ({
      defaultServings: 2,
      units: 'metric',
      diet: { veg: true },
      appLanguage: 'system',
      recipeLanguage: 'original',
      voice: true,
      timerAlerts: true,
      keepAwake: true,
      snappy: false,
      welcomed: false,
      set: (patch) => set(patch),
    }),
    {
      name: 'tortie-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ set: _set, ...rest }) => rest,
    },
  ),
);

/** True once the persisted prefs have been read back from storage. */
export function usePrefsHydrated(): boolean {
  return useSyncExternalStore(
    (cb) => useTortiePrefs.persist.onFinishHydration(cb),
    () => useTortiePrefs.persist.hasHydrated(),
  );
}
