import { hostOf, sourceOf } from '@/features/share/url';
import type { ImportErrorGroup } from '@/features/extraction/error-groups';
import type { Brand } from '@/tortie/ui/brand';

/** Where an import came from: a platform, any website, or a scanned page. */
export type ImportSrc = {
  kind: Brand | 'web' | 'scan';
  /** "Instagram", "Website", "Scanned page". */
  name: string;
  /** "instagram.com" for links; "Scanned page" for scans. */
  host: string;
};

export type ImportStatus = 'running' | 'done' | 'failed';

export type ImportJob = {
  /** Local id, stable across retries of the same run. */
  id: string;
  url: string;
  src: ImportSrc;
  status: ImportStatus;
  /** 0–100. */
  pct: number;
  createdAt: number;
  finishedAt?: number;
  recipeId?: string;
  /** The link was already in the Cookbook; nothing new was added. */
  duplicate?: boolean;
  /** The API job this row mirrors; lets history rebuilt from the server skip duplicates. */
  serverJobId?: string;
  title?: string;
  thumb?: string | null;
  errorCode?: string;
  group?: ImportErrorGroup;
  /** Epoch ms when a rate-limited retry unlocks. */
  retryAt?: number;
};

export const HISTORY_LIMIT = 30;

export function importSrcOf(url: string): ImportSrc {
  const found = sourceOf(url);
  const host = hostOf(url);
  if (!found || found.kind === 'web') {
    return { kind: 'web', name: 'Website', host };
  }
  return { kind: found.kind, name: found.name, host };
}

/** Platform name for error copy; undefined for websites and scans. */
export function brandNameOf(src: ImportSrc): string | undefined {
  return src.kind === 'web' || src.kind === 'scan' ? undefined : src.name;
}

export function runningJobs(jobs: ImportJob[]): ImportJob[] {
  return jobs.filter((j) => j.status === 'running');
}

/** Finished and failed jobs, newest first. */
export function historyJobs(jobs: ImportJob[]): ImportJob[] {
  return jobs
    .filter((j) => j.status !== 'running')
    .sort(
      (a, b) => (b.finishedAt ?? b.createdAt) - (a.finishedAt ?? a.createdAt),
    );
}

/** Mean progress of the running jobs (0 when none). */
export function averageProgress(jobs: ImportJob[]): number {
  const run = runningJobs(jobs);
  if (!run.length) return 0;
  return run.reduce((sum, j) => sum + j.pct, 0) / run.length;
}

export function pillLabel(running: number): string {
  return running === 1 ? 'Importing a recipe' : `Importing ${running} recipes`;
}

/** Keeps every running job and the newest `limit` finished ones. */
export function pruneHistory(
  jobs: ImportJob[],
  limit = HISTORY_LIMIT,
): ImportJob[] {
  const keep = new Set(
    historyJobs(jobs)
      .slice(0, limit)
      .map((j) => j.id),
  );
  return jobs.filter((j) => j.status === 'running' || keep.has(j.id));
}
