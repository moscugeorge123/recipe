import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  withDelay,
  withTiming,
  type WithTimingConfig,
} from 'react-native-reanimated';

import { BASE_D, EASE } from '@/tortie/theme';
import { useTortiePrefs } from '@/tortie/prefs-store';

export type MotionMode = 'Fluid' | 'Snappy' | 'Reduced';

const MULT: Record<MotionMode, number> = {
  Fluid: 1,
  Snappy: 0.6,
  Reduced: 0.01,
};

let osReduced = false;
const listeners = new Set<(v: boolean) => void>();
AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => {
    osReduced = v;
    listeners.forEach((l) => l(v));
  })
  .catch(() => undefined);
AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => {
  osReduced = v;
  listeners.forEach((l) => l(v));
});

function useOsReduced(): boolean {
  const [v, setV] = useState(osReduced);
  useEffect(() => {
    listeners.add(setV);
    return () => {
      listeners.delete(setV);
    };
  }, []);
  return v;
}

export function useMotionMode(): MotionMode {
  const reduced = useOsReduced();
  const snappy = useTortiePrefs((s) => s.snappy);
  if (reduced) return 'Reduced';
  return snappy ? 'Snappy' : 'Fluid';
}

/** Motion multiplier `m` and base duration `D = 480 × m`. */
export function useMotion() {
  const mode = useMotionMode();
  const m = MULT[mode];
  return { mode, m, D: Math.round(BASE_D * m), reduced: mode === 'Reduced' };
}

/** Non-hook access for timers scheduled outside render. */
export function motionMultiplier(): number {
  if (osReduced) return MULT.Reduced;
  return useTortiePrefs.getState().snappy ? MULT.Snappy : MULT.Fluid;
}

/** `withTiming` on the EASE curve, optionally delayed. */
export function easeTo(
  to: number,
  duration: number,
  delay = 0,
  config?: Partial<WithTimingConfig>,
) {
  'worklet';
  const t = withTiming(to, { duration, easing: EASE, ...config });
  return delay > 0 ? withDelay(delay, t) : t;
}
