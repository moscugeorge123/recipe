import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardBottomInset } from '@/lib/keyboard';
import { duration, reanimatedEasing, useReducedMotion } from '@/lib/motion';
import { colors, radii } from '@/theme/tokens';

const MEDIUM_FRACTION = 0.8;

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  accessibilityLabel?: string;
  /** Tall detents (80% → 100%). Off by default — content-sized sheets. */
  expandable?: boolean;
};

export function Sheet({
  visible,
  onClose,
  children,
  accessibilityLabel = 'Sheet',
  expandable = false,
}: SheetProps) {
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const keyboard = useKeyboardBottomInset();
  const keyboardPad = Math.max(0, keyboard.height);
  const [presented, setPresented] = useState(visible);

  const measuredHeight = useSharedValue(0);
  const translateY = useSharedValue(visible ? 0 : windowHeight);
  const overlayOpacity = useSharedValue(visible ? 1 : 0);
  const dragY = useSharedValue(0);
  const sheetMaxH = useSharedValue(windowHeight * MEDIUM_FRACTION);
  const dragStartMaxH = useSharedValue(windowHeight * MEDIUM_FRACTION);
  const windowH = useSharedValue(windowHeight);
  const mediumH = useSharedValue(windowHeight * MEDIUM_FRACTION);
  const keyboardH = useSharedValue(0);
  const isExpanded = useSharedValue(0);
  const expandableSV = useSharedValue(expandable ? 1 : 0);

  useEffect(() => {
    expandableSV.value = expandable ? 1 : 0;
  }, [expandable, expandableSV]);

  useEffect(() => {
    keyboardH.value = withTiming(keyboardPad, {
      duration: reduced ? 0 : keyboard.durationMs,
      easing: reanimatedEasing,
    });
  }, [keyboard.durationMs, keyboardH, keyboardPad, reduced]);

  useEffect(() => {
    windowH.value = windowHeight;
    mediumH.value = windowHeight * MEDIUM_FRACTION;
    if (!expandable) {
      sheetMaxH.value = windowHeight * MEDIUM_FRACTION;
      return;
    }
    if (isExpanded.value < 0.5) {
      sheetMaxH.value = windowHeight * MEDIUM_FRACTION;
    } else {
      sheetMaxH.value = windowHeight;
    }
  }, [
    expandable,
    isExpanded,
    mediumH,
    sheetMaxH,
    windowH,
    windowHeight,
  ]);

  useEffect(() => {
    if (visible) {
      queueMicrotask(() => setPresented(true));
      return;
    }
    isExpanded.value = 0;
    sheetMaxH.value = windowHeight * MEDIUM_FRACTION;
  }, [isExpanded, sheetMaxH, visible, windowHeight]);

  useEffect(() => {
    if (!presented) {
      return;
    }

    const travel = measuredHeight.value || windowHeight;

    if (visible) {
      dragY.value = 0;
      if (reduced) {
        overlayOpacity.value = 1;
        translateY.value = 0;
        return;
      }
      overlayOpacity.value = withTiming(1, {
        duration: duration.fast,
        easing: reanimatedEasing,
      });
      if (measuredHeight.value > 0) {
        translateY.value = withTiming(0, {
          duration: duration.sheet,
          easing: reanimatedEasing,
        });
      }
      return;
    }

    if (reduced) {
      overlayOpacity.value = 0;
      translateY.value = travel;
      dragY.value = 0;
      queueMicrotask(() => setPresented(false));
      return;
    }

    overlayOpacity.value = withTiming(0, {
      duration: duration.fast,
      easing: reanimatedEasing,
    });
    translateY.value = withTiming(
      travel,
      { duration: duration.sheet, easing: reanimatedEasing },
      (finished) => {
        if (finished) {
          runOnJS(setPresented)(false);
        }
      },
    );
  }, [
    dragY,
    measuredHeight,
    overlayOpacity,
    presented,
    reduced,
    translateY,
    visible,
    windowHeight,
  ]);

  const onSheetLayout = (event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    const firstMeasure = measuredHeight.value === 0;
    measuredHeight.value = nextHeight;

    if (!firstMeasure || !visible) {
      return;
    }

    // Shared values are mutated from layout; React Compiler treats them as render state.
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared value
    translateY.value = nextHeight;
    dragY.value = 0;
    if (reduced) {
      translateY.value = 0;
      return;
    }
    translateY.value = withTiming(0, {
      duration: duration.sheet,
      easing: reanimatedEasing,
    });
  };

  const dismissFromDrag = () => {
    onClose();
  };

  const handlePan = Gesture.Pan()
    .enabled(!reduced)
    .activeOffsetY(expandable ? [-6, 6] : 6)
    .failOffsetX([-24, 24])
    .onBegin(() => {
      'worklet';
      dragStartMaxH.value = sheetMaxH.value;
    })
    .onUpdate((event) => {
      'worklet';
      if (expandableSV.value < 0.5) {
        // Content sheet: drag down only to dismiss.
        const next = Math.max(0, event.translationY);
        dragY.value = next;
        const travel = measuredHeight.value || windowH.value;
        overlayOpacity.value =
          1 - Math.min(1, next / Math.max(travel * 0.45, 1)) * 0.55;
        return;
      }

      // Expandable: up grows toward full available height; down shrinks, then dismisses.
      const available = Math.max(0, windowH.value - keyboardH.value);
      const floor = Math.min(mediumH.value, available);
      const unclamped = dragStartMaxH.value - event.translationY;
      const nextMax = Math.min(available, Math.max(floor, unclamped));
      sheetMaxH.value = nextMax;

      if (unclamped < floor) {
        const pull = floor - unclamped;
        dragY.value = pull;
        const travel = measuredHeight.value || windowH.value;
        overlayOpacity.value =
          1 - Math.min(1, pull / Math.max(travel * 0.45, 1)) * 0.55;
      } else {
        dragY.value = 0;
        overlayOpacity.value = 1;
      }
    })
    .onEnd((event) => {
      'worklet';
      if (expandableSV.value < 0.5) {
        const shouldClose =
          event.translationY > 88 || event.velocityY > 900;
        if (shouldClose) {
          runOnJS(dismissFromDrag)();
          return;
        }
        dragY.value = withTiming(0, {
          duration: duration.fast,
          easing: reanimatedEasing,
        });
        overlayOpacity.value = withTiming(1, {
          duration: duration.fast,
          easing: reanimatedEasing,
        });
        return;
      }

      const available = Math.max(0, windowH.value - keyboardH.value);
      const floor = Math.min(mediumH.value, available);
      const pulledPastMedium =
        dragStartMaxH.value - event.translationY < floor;
      const shouldDismiss =
        pulledPastMedium &&
        (event.translationY > 88 ||
          event.velocityY > 900 ||
          dragY.value > 88);

      if (shouldDismiss) {
        runOnJS(dismissFromDrag)();
        return;
      }

      const mid = (floor + available) / 2;
      const expand =
        event.velocityY < -600 ||
        sheetMaxH.value > mid ||
        (event.velocityY < -200 && sheetMaxH.value > floor + 24);

      const target = expand ? available : floor;
      isExpanded.value = expand ? 1 : 0;

      sheetMaxH.value = withTiming(target, {
        duration: duration.sheet,
        easing: reanimatedEasing,
      });
      dragY.value = withTiming(0, {
        duration: duration.fast,
        easing: reanimatedEasing,
      });
      overlayOpacity.value = withTiming(1, {
        duration: duration.fast,
        easing: reanimatedEasing,
      });
    });

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => {
    const kb = keyboardH.value;
    if (expandableSV.value > 0.5) {
      // Fit the sheet into the space above the keyboard (no overflow push).
      const available = Math.max(0, windowH.value - kb);
      const h = Math.min(sheetMaxH.value, available);
      return {
        height: h,
        maxHeight: h,
        marginBottom: kb,
        borderTopLeftRadius: radii.sheet,
        borderTopRightRadius: radii.sheet,
        transform: [{ translateY: translateY.value + dragY.value }],
      };
    }
    return {
      maxHeight: windowH.value * MEDIUM_FRACTION,
      marginBottom: kb,
      borderTopLeftRadius: radii.sheet,
      borderTopRightRadius: radii.sheet,
      transform: [{ translateY: translateY.value + dragY.value }],
    };
  });

  return (
    <Modal
      visible={presented}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* RNGH gestures need a root inside Modal — app root does not cover it. */}
      <GestureHandlerRootView style={styles.root}>
        <View className="flex-1 justify-end">
          <Animated.View className="absolute inset-0" style={overlayStyle}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
              onPress={onClose}
              className="flex-1"
              style={{ backgroundColor: colors.overlay }}
            />
          </Animated.View>
          <Animated.View
            accessibilityViewIsModal
            accessibilityLabel={accessibilityLabel}
            className="overflow-hidden bg-bg px-5 pt-1"
            onLayout={onSheetLayout}
            style={[
              sheetStyle,
              {
                paddingBottom: Math.max(insets.bottom, 34),
              },
            ]}
          >
            <GestureDetector gesture={handlePan}>
              <Animated.View
                accessibilityRole="adjustable"
                accessibilityLabel="Drag sheet"
                style={styles.handleHit}
              >
                <View
                  style={[
                    styles.handleBar,
                    { backgroundColor: colors.steam },
                  ]}
                />
              </Animated.View>
            </GestureDetector>
            <View style={expandable ? styles.bodyFill : undefined}>
              {children}
            </View>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  bodyFill: {
    flex: 1,
    minHeight: 0,
  },
  handleHit: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    height: 44,
    marginHorizontal: -8,
  },
  handleBar: {
    height: 4,
    width: 40,
    borderRadius: 999,
  },
});
