import { useEffect, useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useMotion } from '@/tortie/motion';
import { C, EASE, SH } from '@/tortie/theme';

type SheetProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** z-index of the scrim; the sheet sits at z + 1. */
  z?: number;
  /** Override 520ms × m. */
  ms?: number;
  /** `max-height` as a fraction of the screen (filter sheet uses .86). */
  maxHeight?: number;
  style?: StyleProp<ViewStyle>;
  /** Keep children mounted while closed (default true, like the prototype). */
  keepMounted?: boolean;
};

/**
 * Bottom sheet over a scrim. Sheet translateY 105% → 0 and scrim opacity 0 → 1,
 * both 520ms × m on EASE. Top radius 32, bg #f8faf5, padding `10px 20px 34px`.
 */
export function Sheet({
  open,
  onClose,
  children,
  z = 40,
  ms,
  maxHeight,
  style,
  keepMounted = true,
}: SheetProps) {
  const { m } = useMotion();
  const dur = ms ?? Math.round(520 * m);
  const { height: winH } = useWindowDimensions();
  const [h, setH] = useState(winH);
  const [mounted, setMounted] = useState(open || keepMounted);
  const p = useSharedValue(open ? 1 : 0);
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    p.value = withTiming(
      open ? 1 : 0,
      { duration: dur, easing: EASE },
      (fin) => {
        if (fin && !open && !keepMounted) runOnJS(setMounted)(false);
      },
    );
  }, [open, dur, keepMounted, p]);

  const scrim = useAnimatedStyle(() => ({ opacity: p.value }));
  // Parked sheets sit just below the screen; hide them so the upward shadow
  // doesn't bleed over the tab bar.
  const sheet = useAnimatedStyle(() => ({
    opacity: p.value === 0 ? 0 : 1,
    transform: [{ translateY: (1 - p.value) * h * 1.05 }],
  }));

  if (!mounted) return null;
  return (
    <>
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={[
          StyleSheet.absoluteFill,
          { zIndex: z, backgroundColor: C.scrim },
          scrim,
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close"
        />
      </Animated.View>
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        onLayout={(e) => setH(e.nativeEvent.layout.height)}
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: z + 1,
            backgroundColor: C.bg,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            paddingTop: 10,
            paddingHorizontal: 20,
            paddingBottom: 34,
            boxShadow: SH.sheet,
            maxHeight: maxHeight ? winH * maxHeight : undefined,
          },
          style,
          sheet,
        ]}
      >
        {children}
      </Animated.View>
    </>
  );
}
