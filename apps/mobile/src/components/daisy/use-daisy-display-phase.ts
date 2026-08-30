import { useEffect, useState } from 'react';

import type { DaisyPhase } from '@/components/daisy/phase';

export const DAISY_INTRO_IDLE_MS = 700;
export const DAISY_INTRO_IMPORT_MS = 1300;
export const DAISY_MIN_ANALYZING_MS = 1200;
export const DAISY_SUCCESS_HOLD_MS = 1400;
export const DAISY_REDUCED_FADE_MS = 400;

/**
 * Drives the signature sequence: idle, the card fly-in, then the glasses beat.
 * The mascot owns its own exit, so a backend that finishes instantly still gets
 * the full story instead of a flash.
 */
export function useDaisyDisplayPhase(jobPhase: DaisyPhase, reduced: boolean) {
  const [introStep, setIntroStep] = useState<'idle' | 'importing' | 'done'>(
    'idle',
  );
  const [minAnalyzeElapsed, setMinAnalyzeElapsed] = useState(false);
  const [celebrated, setCelebrated] = useState<DaisyPhase | null>(null);

  const introDone = reduced || introStep === 'done';

  useEffect(() => {
    if (reduced) {
      return;
    }

    const toImporting = setTimeout(() => {
      setIntroStep('importing');
    }, DAISY_INTRO_IDLE_MS);
    const toDone = setTimeout(() => {
      setIntroStep('done');
    }, DAISY_INTRO_IDLE_MS + DAISY_INTRO_IMPORT_MS);

    return () => {
      clearTimeout(toImporting);
      clearTimeout(toDone);
    };
  }, [reduced]);

  const wantsAnalyze =
    jobPhase === 'analyzing' ||
    jobPhase === 'processing' ||
    jobPhase === 'success' ||
    jobPhase === 'error';
  const minAnalyzeDone = reduced || minAnalyzeElapsed;

  useEffect(() => {
    if (reduced || !introDone || !wantsAnalyze || minAnalyzeElapsed) {
      return;
    }
    const timer = setTimeout(() => {
      setMinAnalyzeElapsed(true);
    }, DAISY_MIN_ANALYZING_MS);
    return () => clearTimeout(timer);
  }, [introDone, minAnalyzeElapsed, reduced, wantsAnalyze]);

  const phase: DaisyPhase = !introDone
    ? introStep === 'importing'
      ? 'importing'
      : 'idle'
    : wantsAnalyze && !minAnalyzeDone
      ? 'analyzing'
      : jobPhase;

  useEffect(() => {
    if (phase !== 'success') {
      return;
    }
    const timer = setTimeout(
      () => {
        setCelebrated('success');
      },
      reduced ? DAISY_REDUCED_FADE_MS : DAISY_SUCCESS_HOLD_MS,
    );
    return () => clearTimeout(timer);
  }, [phase, reduced]);

  return {
    phase,
    successReady: phase === 'success' && celebrated === 'success',
  };
}
