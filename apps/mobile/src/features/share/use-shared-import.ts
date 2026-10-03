import { useCallback, useEffect, useRef, useState } from 'react';

import { cancelExtraction } from '@/features/extraction/api';
import { useCreateExtraction } from '@/features/extraction/hooks/use-create-extraction';
import { useExtractionJob } from '@/features/extraction/hooks/use-extraction-job';
import {
  errorCodeOf,
  importFailureToast,
  isAbortError,
} from '@/lib/user-error';
import { useTRecipe } from '@/tortie/data/recipes';
import { toast } from '@/tortie/nav-store';

/** 0 idle · 1 importing · 2 done. */
type Phase = 0 | 1 | 2;

/**
 * Link import used by the share preview. Progress creeps the same way as the
 * add sheet, and cancel aborts the request or the job already on the server.
 */
export function useSharedImport(nonce: number) {
  const create = useCreateExtraction();
  const [phase, setPhase] = useState<Phase>(0);
  const [pct, setPct] = useState(0);
  const [jobId, setJobId] = useState<string | undefined>(undefined);
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const t0 = useRef(0);
  const run = useRef(0);
  const jobRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const phaseRef = useRef<Phase>(0);
  const srcName = useRef<string | undefined>(undefined);
  const seenNonce = useRef(nonce);
  const polled = useRef({
    id: null as string | null,
    progress: 0,
    status: '',
    recipeId: null as string | null,
    error: false,
    errorCode: undefined as string | undefined,
  });

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const job = useExtractionJob(phase === 1 ? jobId : undefined);
  const { r } = useTRecipe(recipeId);

  const fail = useCallback((msg: string) => {
    phaseRef.current = 0;
    run.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    jobRef.current = null;
    setPhase(0);
    setPct(0);
    setJobId(undefined);
    toast(msg);
  }, []);

  const cancel = useCallback(() => {
    if (phaseRef.current !== 1) return;
    phaseRef.current = 0;
    const jobToCancel = jobRef.current;
    run.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    jobRef.current = null;
    setJobId(undefined);
    setPhase(0);
    setPct(0);
    setRecipeId(null);
    if (jobToCancel) cancelExtraction(jobToCancel).catch(() => undefined);
    toast('Import cancelled');
  }, []);

  useEffect(() => {
    if (seenNonce.current === nonce) return;
    seenNonce.current = nonce;
    phaseRef.current = 0;
    const jobToCancel = jobRef.current;
    run.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    jobRef.current = null;
    setPhase(0);
    setPct(0);
    setJobId(undefined);
    setRecipeId(null);
    if (jobToCancel) cancelExtraction(jobToCancel).catch(() => undefined);
  }, [nonce]);

  useEffect(() => {
    polled.current = {
      id: job.job?.id ?? null,
      progress: job.job?.progress ?? 0,
      status: job.job?.status ?? '',
      recipeId: job.job?.recipeId ?? null,
      error: job.isError,
      errorCode: errorCodeOf(job.job?.error),
    };
  }, [job.job, job.isError]);

  useEffect(() => {
    if (phase !== 1) return;
    const runId = run.current;
    let doneT: ReturnType<typeof setTimeout> | null = null;
    let finished = false;
    const iv = setInterval(() => {
      if (run.current !== runId) {
        clearInterval(iv);
        return;
      }
      const L = polled.current;
      const mine = !!jobRef.current && L.id === jobRef.current;
      if (mine || (jobRef.current && L.error)) {
        if (
          L.error ||
          L.status === 'FAILED' ||
          L.status === 'CANCELLED' ||
          (L.status === 'COMPLETED' && !L.recipeId)
        ) {
          clearInterval(iv);
          fail(
            L.error
              ? 'Lost track of that import — try again'
              : L.status === 'CANCELLED'
                ? 'Import cancelled'
                : importFailureToast(L.errorCode, srcName.current),
          );
          return;
        }
        if (L.status === 'COMPLETED' && L.recipeId && !finished) {
          finished = true;
          setRecipeId(L.recipeId);
        }
      }
      const t = Date.now() - t0.current;
      const creep = 94 * (1 - Math.exp(-t / 9000));
      const target = finished
        ? 100
        : Math.min(94, Math.max(mine ? L.progress : 0, creep));
      setPct((p) => {
        const n = Math.min(Math.max(p, target), p + 2.4, 100);
        if (n >= 100 && !doneT) {
          clearInterval(iv);
          doneT = setTimeout(() => {
            if (run.current === runId) {
              phaseRef.current = 2;
              setPhase(2);
            }
          }, 300);
        }
        return n;
      });
    }, 50);
    return () => {
      clearInterval(iv);
      if (doneT) clearTimeout(doneT);
    };
  }, [phase, fail]);

  const start = useCallback(
    (url: string, opts?: { thumbnail?: string; source?: string }) => {
      if (phaseRef.current === 1) return;
      const id = ++run.current;
      srcName.current = opts?.source;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      t0.current = Date.now();
      jobRef.current = null;
      phaseRef.current = 1;
      setPhase(1);
      setPct(0);
      setRecipeId(null);
      setJobId(undefined);
      create.mutate(
        {
          url,
          selectedThumbnailUrl: opts?.thumbnail,
          signal: ctrl.signal,
        },
        {
          onSuccess: (res) => {
            if (run.current !== id) {
              if (
                res.jobId &&
                res.status !== 'completed' &&
                !res.deduplicated
              ) {
                cancelExtraction(res.jobId).catch(() => undefined);
              }
              return;
            }
            if (
              res.recipeId &&
              (res.deduplicated || res.status === 'completed')
            ) {
              setRecipeId(res.recipeId);
              setPct(100);
              phaseRef.current = 2;
              setPhase(2);
              return;
            }
            jobRef.current = res.jobId;
            setJobId(res.jobId);
          },
          onError: (e) => {
            if (run.current !== id || isAbortError(e)) return;
            fail(
              importFailureToast(
                errorCodeOf(e),
                srcName.current,
                'Couldn’t start that import — check the link and try again',
              ),
            );
          },
        },
      );
    },
    [create, fail],
  );

  return { phase, pct, recipe: r, recipeId, start, cancel };
}
