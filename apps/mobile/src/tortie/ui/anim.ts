import { useEffect, useState } from 'react';
import { Dimensions, type LayoutChangeEvent } from 'react-native';
import {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type EasingFunction,
  type SharedValue,
} from 'react-native-reanimated';

import { EASE } from '@/tortie/theme';

/**
 * CSS-transition equivalent for use inside `useAnimatedStyle`:
 * `opacity: tw(on ? 1 : 0, 300)` animates whenever the target changes and
 * starts at the target on first render (like a CSS transition).
 * Works for numbers and colour strings.
 */
export function tw<T extends number | string>(
  to: T,
  ms: number,
  easing?: EasingFunction,
  delay = 0,
): T {
  'worklet';
  // Worklets don't capture closure values used in default parameters, so EASE is read in the body.
  const t = withTiming(to as never, {
    duration: ms,
    easing: easing ?? EASE,
  }) as unknown as T;
  return (delay > 0 ? withDelay(delay, t as never) : t) as T;
}

/**
 * 0 → 1 progress for full-screen layers. Multiply by the live screen size in
 * `useAnimatedStyle` so size changes (web first paint, rotation) never animate.
 */
export function useOpenProgress(
  open: boolean,
  ms: number,
  easing: EasingFunction = EASE,
) {
  const p = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(open ? 1 : 0, { duration: ms, easing });
  }, [open, ms, easing, p]);
  return p;
}

/**
 * Bottom-up slide for full-screen layers driven by `useOpenProgress`.
 * Translates by the layer's own measured height (screen height until laid
 * out) — the window height is shorter than the layer on edge-to-edge Android.
 * Hidden at 0 so upward shadows don't bleed while parked.
 */
export function useSlideUp(p: SharedValue<number>) {
  const [h, setH] = useState(() => Dimensions.get('screen').height);
  const style = useAnimatedStyle(() => ({
    opacity: p.value === 0 ? 0 : 1,
    transform: [{ translateY: (1 - p.value) * h }],
  }));
  const onLayout = (e: LayoutChangeEvent) => setH(e.nativeEvent.layout.height);
  return { style, onLayout };
}
