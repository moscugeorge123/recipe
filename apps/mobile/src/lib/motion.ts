import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { usePreferencesStore } from '@/stores/preferences-store';

export const easing = [0.2, 0.8, 0.2, 1] as const;

export const reanimatedEasing = Easing.bezier(0.2, 0.8, 0.2, 1);

export const duration = {
  instant: 120,
  fast: 180,
  sheet: 300,
  step: 380,
  toast: 260,
} as const;

/** System-wide press: `{component.button-primary-active}` scale(0.95). */
export const PRESS_SCALE = 0.95;

export function useReducedMotion(): boolean {
  const pref = usePreferencesStore((state) => state.reduceMotion);
  const [system, setSystem] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) {
          setSystem(value);
        }
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setSystem,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  if (pref === 'reduce') {
    return true;
  }
  if (pref === 'full') {
    return false;
  }
  return system;
}

export function usePopScale(trigger?: number | string | boolean) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  const pop = () => {
    if (reduced) {
      return;
    }
    scale.value = withSequence(
      withTiming(1.14, {
        duration: duration.instant,
        easing: reanimatedEasing,
      }),
      withTiming(1, { duration: duration.fast, easing: reanimatedEasing }),
    );
  };

  useEffect(() => {
    if (trigger === undefined || reduced) {
      return;
    }
    pop();
    // Intentionally react to trigger changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { pop, style, reduced };
}

export function useBreathe(active: boolean) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduced || !active) {
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 700, easing: reanimatedEasing }),
        withTiming(1, { duration: 700, easing: reanimatedEasing }),
      ),
      -1,
      false,
    );
  }, [active, opacity, reduced]);

  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}
