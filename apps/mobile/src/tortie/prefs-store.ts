import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AppLanguagePref, RecipeLanguagePref } from '@/i18n/languages';

export type Units = 'metric' | 'imperial';

/**
 * Device-local preferences shown on Profile and in Cook mode.
 * The API has no endpoints for these yet.
 */
type TortiePrefs = {
  defaultServings: number;
  /** Ingredient amounts, step heat, in-step measurements and grocery amounts. */
  units: Units;
  /** Language of the app's own menus and messages; 'system' follows the device. */
  appLanguage: AppLanguagePref;
  /** Language recipes are shown in; 'original' keeps each recipe as saved. */
  recipeLanguage: RecipeLanguagePref;
  timerAlerts: boolean;
  /** Minutes the "Snooze" button on a finished timer adds. */
  snoozeMinutes: number;
  keepAwake: boolean;
  snappy: boolean;
  /** The first-run tour was finished or skipped on this device. */
  welcomed: boolean;
  set: (patch: Partial<Omit<TortiePrefs, 'set'>>) => void;
};

/** Bump when a stored field is removed or renamed. */
export const PREFS_VERSION = 1;

/** v0 stored `diet` and `voice` settings that nothing read; drop them. */
export function migratePrefs(stored: unknown, _version: number) {
  if (!stored || typeof stored !== 'object') return stored as TortiePrefs;
  const {
    diet: _diet,
    voice: _voice,
    ...rest
  } = stored as Record<string, unknown>;
  return rest as unknown as TortiePrefs;
}

export const useTortiePrefs = create<TortiePrefs>()(
  persist(
    (set) => ({
      defaultServings: 2,
      units: 'metric',
      appLanguage: 'system',
      recipeLanguage: 'original',
      timerAlerts: true,
      snoozeMinutes: 1,
      keepAwake: true,
      snappy: false,
      welcomed: false,
      set: (patch) => set(patch),
    }),
    {
      name: 'tortie-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      version: PREFS_VERSION,
      migrate: migratePrefs,
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
