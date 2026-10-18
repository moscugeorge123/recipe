import { cancelImport, startImport } from '@/tortie/data/import-engine';
import { useTRecipe } from '@/tortie/data/recipes';
import { useImports } from '@/tortie/import-store';
import { useNav } from '@/tortie/nav-store';

/** 0 idle · 1 importing · 2 done. A failed import goes back to idle (its toast says why). */
export type SharePhase = 0 | 1 | 2;

/** Phase of the import the share screen is showing. */
export function sharePhaseOf(
  status: 'running' | 'done' | 'failed' | undefined,
): SharePhase {
  return status === 'running' ? 1 : status === 'done' ? 2 : 0;
}

/**
 * Link import used by the share preview. It is the shared import engine: the job shows up in
 * the pill and the Imports screen, keeps running when the share screen closes, and only
 * `cancel` stops it.
 */
export function useSharedImport() {
  const jobId = useNav((s) => s.shareJobId);
  const job = useImports((s) => s.jobs.find((j) => j.id === jobId));
  const phase = sharePhaseOf(job?.status);
  const recipeId = phase === 2 ? (job?.recipeId ?? null) : null;
  const { r } = useTRecipe(recipeId);

  const start = (url: string, opts?: { thumbnail?: string }) => {
    if (phase === 1) return;
    useNav.setState({ shareJobId: startImport(url, opts) });
  };

  const cancel = () => {
    if (job?.status === 'running') cancelImport(job.id);
  };

  return { phase, pct: job?.pct ?? 0, job, recipe: r, recipeId, start, cancel };
}
