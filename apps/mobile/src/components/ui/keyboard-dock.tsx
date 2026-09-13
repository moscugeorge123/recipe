import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Dimensions, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { keyboardOverlayInset, useKeyboardBottomInset } from '@/lib/keyboard';
import { reanimatedEasing, useReducedMotion } from '@/lib/motion';

/**
 * Shrinks the app so the soft keyboard sits under it, not over it.
 * Uses flex fill when the keyboard is closed so the tab bar sits flush.
 */
export function KeyboardDock({ children }: { children: ReactNode }) {
  const keyboard = useKeyboardBottomInset();
  const { height: windowHeight } = useWindowDimensions();
  const screenHeight = Dimensions.get('screen').height;
  const reduced = useReducedMotion();
  const inset = keyboardOverlayInset(
    windowHeight,
    keyboard.screenY,
    keyboard.height,
    screenHeight,
  );
  const pad = useSharedValue(inset);

  useEffect(() => {
    pad.value = withTiming(inset, {
      duration: reduced ? 0 : keyboard.durationMs,
      easing: reanimatedEasing,
    });
  }, [inset, keyboard.durationMs, pad, reduced]);

  const style = useAnimatedStyle(() => ({
    flex: 1,
    marginBottom: pad.value,
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
