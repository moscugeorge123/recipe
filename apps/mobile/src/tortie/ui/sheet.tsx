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
import {
  Gesture,
  GestureDetector,
  type GestureType,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMotion } from '@/tortie/motion';
import { C, EASE, SH } from '@/tortie/theme';
import { BlurWhenClosed, KeyboardScroll } from '@/tortie/ui/input';
import { useKeyboard, useKeyboardLift } from '@/tortie/ui/keyboard';
import { sheetDragDecision } from '@/tortie/ui/sheet-drag';
import { SheetScrollCtx, type SheetScrollApi } from '@/tortie/ui/sheet-scroll';

export { SheetScroll } from '@/tortie/ui/sheet-scroll';

const KEYBOARD_TOP_GAP = 8;
const KEYBOARD_BOTTOM_GAP = 16;

const SheetDrag = createContext<GestureType | null>(null);

function releaseSheetDrag(
  dragY: SharedValue<number>,
  p: SharedValue<number>,
  hSv: SharedValue<number>,
  durSv: SharedValue<number>,
  velocityY: number,
  success: boolean,
  requestClose: () => void,
) {
  'worklet';
  const height = Math.max(hSv.value, 1);
  const travel = height * 1.05;
  const y = dragY.value;
  const dismiss =
    success &&
    (y > Math.min(120, height * 0.22) || (y > 12 && velocityY > 850));
  if (dismiss) {
    p.value = Math.max(0, 1 - Math.min(y, travel) / travel);
    dragY.value = 0;
    runOnJS(requestClose)();
    return;
  }
  if (y <= 0) return;
  dragY.value = withTiming(0, {
    duration: Math.min(durSv.value, 320),
    easing: EASE,
  });
}

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

  const scrollY = useSharedValue(0);
  const contentH = useSharedValue(0);
  const viewH = useSharedValue(0);
  const scrollActive = useSharedValue(0);
  const owner = useSharedValue(0);
  const pulling = useSharedValue(0);
  const anchor = useSharedValue(0);
  const decided = useSharedValue(0);
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);
  const nativeRef = useRef<GestureType | undefined>(undefined);
  const panRef = useRef<GestureType | undefined>(undefined);

  const native = useMemo(
    () =>
      Gesture.Native()
        .withRef(nativeRef)
        .simultaneousWithExternalGesture(panRef)
        .shouldCancelWhenOutside(false)
        .onBegin(() => {
          scrollActive.value = 1;
        })
        .onFinalize(() => {
          scrollActive.value = 0;
        }),
    [scrollActive],
  );
  const scrollApi = useMemo<SheetScrollApi>(
    () => ({ native, scrollY, contentH, viewH, scrollActive }),
    [native, scrollY, contentH, viewH, scrollActive],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .manualActivation(true)
        .withRef(panRef)
        .simultaneousWithExternalGesture(nativeRef)
        .shouldCancelWhenOutside(false)
        .onTouchesDown((e) => {
          if (e.numberOfTouches !== 1) return;
          const t = e.allTouches[0];
          if (!t) return;
          originX.value = t.absoluteX;
          originY.value = t.absoluteY;
          decided.value = 0;
          pulling.value = 0;
        })
        .onTouchesMove((e, state) => {
          if (decided.value !== 0) return;
          if (owner.value === 1) {
            decided.value = 1;
            state.fail();
            return;
          }
          const t = e.allTouches[0];
          if (!t) return;
          const decision = sheetDragDecision({
            dx: t.absoluteX - originX.value,
            dy: t.absoluteY - originY.value,
            contentH: contentH.value,
            viewH: viewH.value,
            scrollY: scrollY.value,
            scrollActive: scrollActive.value === 1,
          });
          if (decision === 'wait') return;
          decided.value = 1;
          if (decision === 'activate') state.activate();
          else state.fail();
        })
        .onStart(() => {
          owner.value = 2;
          pulling.value = 0;
        })
        .onUpdate((e) => {
          if (owner.value !== 2) return;
          if (!pulling.value) {
            pulling.value = 1;
            anchor.value = e.translationY;
          }
          dragY.value = Math.max(0, e.translationY - anchor.value);
        })
        .onFinalize((e, success) => {
          decided.value = 0;
          pulling.value = 0;
          if (owner.value !== 2) return;
          owner.value = 0;
          releaseSheetDrag(
            dragY,
            p,
            hSv,
            durSv,
            e.velocityY,
            success,
            requestClose,
          );
        }),
    [
      anchor,
      contentH,
      decided,
      dragY,
      durSv,
      hSv,
      originX,
      originY,
      owner,
      p,
      pulling,
      requestClose,
      scrollActive,
      scrollY,
      viewH,
    ],
  );

  const drag = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(4)
        .blocksExternalGesture(pan)
        .onStart(() => {
          owner.value = 1;
        })
        .onUpdate((e) => {
          dragY.value = Math.max(0, e.translationY);
        })
        .onFinalize((e, success) => {
          if (owner.value !== 1) return;
          owner.value = 0;
          releaseSheetDrag(
            dragY,
            p,
            hSv,
            durSv,
            e.velocityY,
            success,
            requestClose,
          );
        }),
    [dragY, durSv, hSv, owner, p, pan, requestClose],
  );

  const scrim = useAnimatedStyle(() => {
    const travel = Math.max(hSv.value * 1.05, 1);
    const dragged = 1 - Math.min(dragY.value / travel, 1);
    return { opacity: p.value * dragged };
  });
  // Parked sheets sit just below the screen; hide them so the upward shadow
  // doesn't bleed over the tab bar. `dragY` follows a downward drag.
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
      <GestureDetector gesture={pan} touchAction="pan-y">
        <Animated.View
          collapsable={false}
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
            <SheetScrollCtx.Provider value={scrollApi}>
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
            </SheetScrollCtx.Provider>
          </SheetDrag.Provider>
        </Animated.View>
      </GestureDetector>
    </>
  );
}
