import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { AccessibilityInfo } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  ZoomIn,
  ZoomOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { usePreferencesStore } from '@/stores/preferences-store';

type AnimatedViewProps = ComponentProps<typeof Animated.View>;

export type MotionEntering = AnimatedViewProps['entering'];
export type MotionExiting = AnimatedViewProps['exiting'];
export type MotionLayout = AnimatedViewProps['layout'];

export type MotionPreset =
  | 'section'
  | 'card'
  | 'chip'
  | 'timeline'
  | 'mosaic'
  | 'pantry'
  | 'content'
  | 'toast'
  | 'step';

export const easing = [0.2, 0.8, 0.2, 1] as const;

export const reanimatedEasing = Easing.bezier(0.2, 0.8, 0.2, 1);

export const duration = {
  instant: 120,
  fast: 180,
  sheet: 300,
  step: 380,
  toast: 260,
} as const;

export function staggerDelay(index: number, step = 40, cap = 240): number {
  return Math.min(Math.max(index, 0) * step, cap);
}

export type StackPushAnimation = 'none' | 'fade';

/** Page transition for stack and tab routes — same crossfade as the tab menu. */
export function stackPushAnimation(reduced: boolean): StackPushAnimation {
  return reduced ? 'none' : 'fade';
}

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

export function enterSection(
  reduced: boolean,
  index = 0,
): MotionEntering | undefined {
  if (reduced) {
    return undefined;
  }
  return FadeInDown.delay(staggerDelay(index))
    .duration(duration.fast)
    .easing(reanimatedEasing);
}

export function enterCard(
  reduced: boolean,
  _index = 0,
): MotionEntering | undefined {
  if (reduced) {
    return undefined;
  }
  return FadeIn.duration(duration.fast).withInitialValues({ opacity: 0.5 });
}

export function enterChip(reduced: boolean): MotionEntering | undefined {
  if (reduced) {
    return undefined;
  }
  return ZoomIn.duration(duration.fast).easing(reanimatedEasing);
}

export function exitChip(reduced: boolean): MotionExiting | undefined {
  if (reduced) {
    return undefined;
  }
  return ZoomOut.duration(duration.instant);
}

export function enterTimeline(
  reduced: boolean,
  index = 0,
): MotionEntering | undefined {
  if (reduced) {
    return undefined;
  }
  return FadeInDown.delay(staggerDelay(index, 48, 200))
    .duration(duration.fast)
    .easing(reanimatedEasing);
}

export function enterMosaic(
  reduced: boolean,
  index = 0,
): MotionEntering | undefined {
  if (reduced) {
    return undefined;
  }
  return FadeIn.delay(staggerDelay(index, 50, 150)).duration(duration.fast);
}

export function enterPantryMorph(
  reduced: boolean,
  index = 0,
): MotionEntering | undefined {
  if (reduced) {
    return undefined;
  }
  return FadeIn.delay(staggerDelay(index, 24, 120)).duration(duration.instant);
}

export function enterContent(reduced: boolean): MotionEntering | undefined {
  if (reduced) {
    return undefined;
  }
  return FadeIn.duration(duration.fast);
}

export function enterToast(reduced: boolean): MotionEntering | undefined {
  if (reduced) {
    return undefined;
  }
  return FadeInDown.duration(duration.toast).easing(reanimatedEasing);
}

export function exitToast(reduced: boolean): MotionExiting | undefined {
  if (reduced) {
    return undefined;
  }
  return FadeOut.duration(duration.instant);
}

export function enterStep(reduced: boolean): MotionEntering | undefined {
  if (reduced) {
    return undefined;
  }
  return FadeIn.duration(duration.step);
}

export function layoutReorder(reduced: boolean): MotionLayout | undefined {
  if (reduced) {
    return undefined;
  }
  return LinearTransition.duration(duration.fast).easing(reanimatedEasing);
}

export function motionEntering(
  preset: MotionPreset,
  reduced: boolean,
  index = 0,
): MotionEntering | undefined {
  switch (preset) {
    case 'section':
      return enterSection(reduced, index);
    case 'card':
      return enterCard(reduced, index);
    case 'chip':
      return enterChip(reduced);
    case 'timeline':
      return enterTimeline(reduced, index);
    case 'mosaic':
      return enterMosaic(reduced, index);
    case 'pantry':
      return enterPantryMorph(reduced, index);
    case 'content':
      return enterContent(reduced);
    case 'toast':
      return enterToast(reduced);
    case 'step':
      return enterStep(reduced);
  }
}

export function motionExiting(
  preset: MotionPreset,
  reduced: boolean,
): MotionExiting | undefined {
  if (preset === 'chip') {
    return exitChip(reduced);
  }
  if (preset === 'toast') {
    return exitToast(reduced);
  }
  return undefined;
}

export function usePopScale(
  trigger?: number | string | boolean,
  options?: { skipInitial?: boolean },
) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const primed = useRef(!options?.skipInitial);

  const pop = () => {
    if (reduced) {
      return;
    }
    scale.value = withSequence(
      withTiming(1.06, { duration: duration.instant, easing: reanimatedEasing }),
      withTiming(1, { duration: duration.fast, easing: reanimatedEasing }),
    );
  };

  useEffect(() => {
    if (trigger === undefined || reduced) {
      return;
    }
    if (!primed.current) {
      primed.current = true;
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

export function useValueCrossfade(value: string | number) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);
  const rendered = String(value);

  useEffect(() => {
    if (reduced) {
      opacity.value = 1;
      return;
    }
    opacity.value = 0.35;
    opacity.value = withTiming(1, {
      duration: duration.fast,
      easing: reanimatedEasing,
    });
  }, [opacity, reduced, rendered]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return { style, reduced, value: rendered };
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
