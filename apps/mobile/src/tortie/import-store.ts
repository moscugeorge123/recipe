import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  pruneHistory,
  type ImportJob,
} from '@/features/extraction/import-jobs';

type ImportStore = {
  /** Running jobs, then history. Only finished ones are persisted. */
  jobs: ImportJob[];
  /** The job the Add sheet is showing (progress, done or error). */
  focusId: string | null;
  add: (job: ImportJob) => void;
  patch: (id: string, p: Partial<ImportJob>) => void;
  remove: (id: string) => void;
  /** Drops finished and failed rows; running jobs stay. */
  clearHistory: () => void;
  setFocus: (id: string | null) => void;
};

export const useImports = create<ImportStore>()(
  persist(
    (set) => ({
      jobs: [],
      focusId: null,
      add: (job) => set((s) => ({ jobs: pruneHistory([...s.jobs, job]) })),
      patch: (id, p) =>
        set((s) => ({
          jobs: pruneHistory(
            s.jobs.map((j) => (j.id === id ? { ...j, ...p } : j)),
          ),
        })),
      remove: (id) =>
        set((s) => ({
          jobs: s.jobs.filter((j) => j.id !== id),
          focusId: s.focusId === id ? null : s.focusId,
        })),
      clearHistory: () =>
        set((s) => ({
          jobs: s.jobs.filter((j) => j.status === 'running'),
          focusId:
            s.jobs.find((j) => j.id === s.focusId)?.status === 'running'
              ? s.focusId
              : null,
        })),
      setFocus: (id) => set({ focusId: id }),
    }),
    {
      name: 'tortie-imports',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        jobs: s.jobs.filter((j) => j.status !== 'running'),
      }),
    },
  ),
);
