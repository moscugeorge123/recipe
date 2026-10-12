import {
  cancelExtraction,
  createExtraction,
  getExtractionJob,
} from '@/features/extraction/api';
import {
  RATE_LIMIT_COUNTDOWN_S,
  errorGroupOf,
} from '@/features/extraction/error-groups';
import {
  brandNameOf,
  importSrcOf,
  type ImportSrc,
} from '@/features/extraction/import-jobs';
import { recipeKeys } from '@/features/query-keys';
import { getRecipe } from '@/features/recipes/api';
import { queryClient } from '@/lib/query-client';
import {
  errorCodeOf,
  importFailureToast,
  isAbortError,
} from '@/lib/user-error';
import { ApiError } from '@/services/api-client';
import { useImports } from '@/tortie/import-store';
import { toast, useNav } from '@/tortie/nav-store';

/**
 * Link imports that outlive the Add sheet. The store holds what the UI shows;
 * this module owns the network side: create the job, poll it every few seconds,
 * creep the bar between polls, and settle the job as done or failed.
 */

const TICK_MS = 100;
const POLL_MS = 4000;
const RATE_LIMIT_BACKOFF_MS = 5000;
const POLL_FAILURES_BEFORE_GIVING_UP = 3;
/** Creep time constants: a retry from history runs slower than a live import. */
const CREEP_MS = 9000;
const CREEP_MS_SLOW = 16000;
/** The old sheet's pace: +2.4 per 50ms, never going back. */
const STEP_PER_MS = 2.4 / 50;
const DONE_HOLD_MS = 300;

export const LOST_TRACK = 'LOST_TRACK';

type Runtime = {
  t0: number;
  slow: boolean;
  ctrl: AbortController;
  serverJobId?: string;
  nextPollAt: number;
  polling: boolean;
  pollFailures: number;
  /** Latest poll result. */
  serverProgress: number;
  /** Set once the API says the recipe is saved; the bar then runs to 100. */
  recipeId?: string;
  doneAt?: number;
  lastTick: number;
};

const runtimes = new Map<string, Runtime>();
let ticker: ReturnType<typeof setInterval> | null = null;
let seq = 0;

function shownInSheet(id: string): boolean {
  return useNav.getState().addSheet && useImports.getState().focusId === id;
}

/**
 * Starts an import and returns its local id. Pass `slow` for a retry from
 * history, which creeps more gently.
 */
export function startImport(
  url: string,
  opts: { slow?: boolean; src?: ImportSrc; thumbnail?: string } = {},
): string {
  const id = `imp-${Date.now().toString(36)}-${++seq}`;
  const src = opts.src ?? importSrcOf(url);
  const ctrl = new AbortController();
  const now = Date.now();
  useImports.getState().add({
    id,
    url,
    src,
    status: 'running',
    pct: 0,
    createdAt: now,
  });
  runtimes.set(id, {
    t0: now,
    slow: !!opts.slow,
    ctrl,
    nextPollAt: now + POLL_MS,
    polling: false,
    pollFailures: 0,
    serverProgress: 0,
    lastTick: now,
  });
  ensureTicker();

  createExtraction({ url, selectedThumbnailUrl: opts.thumbnail }, ctrl.signal)
    .then((res) => {
      const rt = runtimes.get(id);
      if (!rt) {
        // Cancelled while the request was in flight.
        if (res.status !== 'completed' && !res.deduplicated) {
          cancelExtraction(res.jobId).catch(() => undefined);
        }
        return;
      }
      if (res.recipeId && (res.deduplicated || res.status === 'completed')) {
        rt.recipeId = res.recipeId;
        return;
      }
      rt.serverJobId = res.jobId;
      rt.nextPollAt = Date.now() + POLL_MS;
    })
    .catch((e) => {
      if (!runtimes.has(id) || isAbortError(e)) return;
      fail(id, errorCodeOf(e) ?? 'EXTRACTION_FAILED');
    });

  return id;
}

/** Stops a running import and drops it from the list. */
export function cancelImport(id: string): void {
  const rt = runtimes.get(id);
  if (!rt) return;
  runtimes.delete(id);
  rt.ctrl.abort();
  if (rt.serverJobId) cancelExtraction(rt.serverJobId).catch(() => undefined);
  useImports.getState().remove(id);
  toast('Import cancelled');
  stopTickerIfIdle();
}

/** Replaces a failed job with a fresh run of the same link. */
export function retryImport(
  id: string,
  opts: { slow?: boolean } = {},
): string | null {
  const job = useImports.getState().jobs.find((j) => j.id === id);
  if (!job || job.status !== 'failed') return null;
  useImports.getState().remove(id);
  return startImport(job.url, { src: job.src, slow: opts.slow });
}

function ensureTicker() {
  if (ticker) return;
  ticker = setInterval(tick, TICK_MS);
}

function stopTickerIfIdle() {
  if (runtimes.size || !ticker) return;
  clearInterval(ticker);
  ticker = null;
}

function fail(id: string, code: string) {
  if (!runtimes.delete(id)) return;
  const store = useImports.getState();
  const job = store.jobs.find((j) => j.id === id);
  if (!job) return;
  const group = errorGroupOf(code);
  const now = Date.now();
  store.patch(id, {
    status: 'failed',
    errorCode: code,
    group,
    finishedAt: now,
    retryAt:
      group === 'rate_limited'
        ? now + RATE_LIMIT_COUNTDOWN_S * 1000
        : undefined,
  });
  if (!shownInSheet(id)) {
    toast(
      code === LOST_TRACK
        ? 'Lost track of that import — try again'
        : importFailureToast(code, brandNameOf(job.src)),
      'error',
    );
  }
  stopTickerIfIdle();
}

function complete(id: string, recipeId: string) {
  if (!runtimes.delete(id)) return;
  useImports.getState().patch(id, {
    status: 'done',
    pct: 100,
    recipeId,
    finishedAt: Date.now(),
  });
  queryClient
    .invalidateQueries({ queryKey: recipeKeys.all })
    .catch(() => undefined);
  const quiet = shownInSheet(id);
  // The history row wants a title and photo, and the toast wants the title.
  getRecipe(recipeId)
    .then((r) => {
      useImports
        .getState()
        .patch(id, { title: r.title, thumb: r.thumbnailUrl ?? null });
      if (!quiet) toast(`${r.title} added to Cookbook`);
    })
    .catch(() => {
      if (!quiet) toast('Recipe added to Cookbook');
    });
  stopTickerIfIdle();
}

function poll(id: string, rt: Runtime) {
  const serverId = rt.serverJobId;
  if (!serverId || rt.polling) return;
  rt.polling = true;
  getExtractionJob(serverId, rt.ctrl.signal)
    .then((job) => {
      if (!runtimes.has(id)) return;
      rt.polling = false;
      rt.pollFailures = 0;
      rt.nextPollAt = Date.now() + POLL_MS;
      rt.serverProgress = job.progress;
      if (job.status === 'COMPLETED' && job.recipeId) {
        rt.recipeId = job.recipeId;
      } else if (job.status === 'COMPLETED') {
        fail(id, 'EXTRACTION_FAILED');
      } else if (job.status === 'FAILED') {
        fail(id, errorCodeOf(job.error) ?? 'EXTRACTION_FAILED');
      } else if (job.status === 'CANCELLED') {
        // Cancelled from elsewhere; drop it like a local cancel.
        runtimes.delete(id);
        useImports.getState().remove(id);
        stopTickerIfIdle();
      }
    })
    .catch((e) => {
      if (!runtimes.has(id) || isAbortError(e)) return;
      rt.polling = false;
      if (
        e instanceof ApiError &&
        (e.status === 429 || e.code === 'TOO_MANY_REQUESTS')
      ) {
        rt.nextPollAt = Date.now() + RATE_LIMIT_BACKOFF_MS;
        return;
      }
      rt.pollFailures += 1;
      rt.nextPollAt = Date.now() + POLL_MS;
      if (rt.pollFailures >= POLL_FAILURES_BEFORE_GIVING_UP) {
        fail(id, LOST_TRACK);
      }
    });
}

function tick() {
  const now = Date.now();
  const store = useImports.getState();
  for (const [id, rt] of [...runtimes]) {
    const dt = now - rt.lastTick;
    rt.lastTick = now;
    if (rt.serverJobId && now >= rt.nextPollAt) poll(id, rt);
    if (!runtimes.has(id)) continue;

    const job = store.jobs.find((j) => j.id === id);
    if (!job) {
      runtimes.delete(id);
      continue;
    }
    if (rt.doneAt) {
      if (now >= rt.doneAt) complete(id, rt.recipeId!);
      continue;
    }
    const creep =
      94 *
      (1 - Math.exp(-(now - rt.t0) / (rt.slow ? CREEP_MS_SLOW : CREEP_MS)));
    const target = rt.recipeId
      ? 100
      : Math.min(94, Math.max(rt.serverProgress, creep));
    const stepMax = STEP_PER_MS * dt * (rt.slow ? 0.5 : 1);
    const next = Math.min(Math.max(job.pct, target), job.pct + stepMax, 100);
    if (next - job.pct >= 0.25 || (next >= 100 && job.pct < 100)) {
      store.patch(id, { pct: next });
    }
    if (next >= 100) rt.doneAt = now + DONE_HOLD_MS;
  }
  stopTickerIfIdle();
}
