import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Pressable,
  StyleSheet,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, type PanGesture } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMotion } from '@/tortie/motion';
import { C, EASE, SH } from '@/tortie/theme';
import { BlurWhenClosed, KeyboardScroll } from '@/tortie/ui/input';
import { useKeyboard, useKeyboardLift } from '@/tortie/ui/keyboard';

const KEYBOARD_TOP_GAP = 8;
const KEYBOARD_BOTTOM_GAP = 16;

const SheetDrag = createContext<PanGesture | null>(null);

/** Pan gesture for the sheet grabber. Null outside a `Sheet`. */
export function useSheetDrag() {
  return useContext(SheetDrag);
}

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
  /**
   * Required when the sheet holds an `Input`: docks the sheet on the keyboard,
   * caps it below the status bar and scrolls the focused field into view.
   */
  avoidKeyboard?: boolean;
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
  avoidKeyboard = false,
}: SheetProps) {
  const { m } = useMotion();
  const dur = ms ?? Math.round(520 * m);
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const kb = useKeyboard();
  const lift = useKeyboardLift(KEYBOARD_BOTTOM_GAP);
  const frame = kb.frame > 0 ? kb.frame : winH;
  const kbCap =
    avoidKeyboard && kb.h > 0
      ? Math.max(
          0,
          frame - kb.h - KEYBOARD_BOTTOM_GAP - insets.top - KEYBOARD_TOP_GAP,
        )
      : undefined;
  const cap = maxHeight ? winH * maxHeight : undefined;
  const [mounted, setMounted] = useState(open || keepMounted);
  const p = useSharedValue(open ? 1 : 0);
  const dragY = useSharedValue(0);
  const hSv = useSharedValue(winH);
  const durSv = useSharedValue(dur);
  durSv.value = dur;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  if (open && !mounted) setMounted(true);

  const requestClose = useCallback(() => {
    onCloseRef.current();
  }, []);

  useEffect(() => {
    if (open) dragY.value = 0;
    p.value = withTiming(
      open ? 1 : 0,
      { duration: dur, easing: EASE },
      (fin) => {
        if (fin && !open && !keepMounted) runOnJS(setMounted)(false);
      },
    );
  }, [open, dur, keepMounted, p, dragY]);

  const drag = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(4)
        .onUpdate((e) => {
          dragY.value = Math.max(0, e.translationY);
        })
        .onFinalize((e, success) => {
          const height = Math.max(hSv.value, 1);
          const travel = height * 1.05;
          const y = dragY.value;
          const dismiss =
            success &&
            (y > Math.min(120, height * 0.22) || (y > 12 && e.velocityY > 850));
          if (dismiss) {
            p.value = Math.max(0, 1 - Math.min(y, travel) / travel);
            dragY.value = 0;
            runOnJS(requestClose)();
            return;
          }
          dragY.value = withTiming(0, {
            duration: Math.min(durSv.value, 320),
            easing: EASE,
          });
        }),
    [dragY, durSv, hSv, p, requestClose],
  );

  const scrim = useAnimatedStyle(() => {
    const travel = Math.max(hSv.value * 1.05, 1);
    const dragged = 1 - Math.min(dragY.value / travel, 1);
    return { opacity: p.value * dragged };
  });
  // Parked sheets sit just below the screen; hide them so the upward shadow
  // doesn't bleed over the tab bar. `dragY` lets the grabber pull the sheet.
  const sheet = useAnimatedStyle(() => ({
    opacity: p.value === 0 && dragY.value === 0 ? 0 : 1,
    transform: [{ translateY: (1 - p.value) * hSv.value * 1.05 + dragY.value }],
  }));

  if (!mounted) return null;
  const flat = StyleSheet.flatten(style);
  const padTop = typeof flat?.paddingTop === 'number' ? flat.paddingTop : 10;
  const padBottom =
    typeof flat?.paddingBottom === 'number' ? flat.paddingBottom : 34;
  const sheetMax =
    cap != null && kbCap != null ? Math.min(cap, kbCap) : (cap ?? kbCap);
  const scrollMax =
    sheetMax != null ? Math.max(0, sheetMax - padTop - padBottom) : undefined;
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
        onLayout={(e) => {
          hSv.value = e.nativeEvent.layout.height;
        }}
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
            maxHeight: sheetMax,
          },
          style,
          avoidKeyboard ? lift : null,
          sheet,
        ]}
      >
        <SheetDrag.Provider value={drag}>
          <BlurWhenClosed open={open}>
            {avoidKeyboard ? (
              <KeyboardScroll
                lifted
                bounces={false}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                style={{ flexGrow: 0, maxHeight: scrollMax }}
              >
                {children}
              </KeyboardScroll>
            ) : (
              children
            )}
          </BlurWhenClosed>
        </SheetDrag.Provider>
      </Animated.View>
    </>
  );
}
