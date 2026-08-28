import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { PreferencesState } from '@/stores/contracts';

export const DEFAULT_DISPLAY_NAME = 'Sam';

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      displayName: DEFAULT_DISPLAY_NAME,
      hasOnboarded: false,
      cookingTheme: 'dark',
      reduceMotion: 'system',
      units: 'metric',
      tasteTags: [],
      setDisplayName: (displayName) => set({ displayName }),
      completeOnboarding: () => set({ hasOnboarded: true }),
      replayOnboarding: () => set({ hasOnboarded: false }),
      setCookingTheme: (cookingTheme) => set({ cookingTheme }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setUnits: (units) => set({ units }),
      setTasteTags: (tasteTags) => set({ tasteTags }),
      reset: () =>
        set({
          displayName: DEFAULT_DISPLAY_NAME,
          hasOnboarded: false,
          cookingTheme: 'dark',
          reduceMotion: 'system',
          units: 'metric',
          tasteTags: [],
        }),
    }),
    {
      name: 'mise.prefs.v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
