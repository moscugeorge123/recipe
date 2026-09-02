import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { duration, reanimatedEasing, useReducedMotion } from '@/lib/motion';
import { colors, radii, shadows } from '@/theme/tokens';

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  accessibilityLabel?: string;
};

export function Sheet({
  visible,
  onClose,
  children,
  accessibilityLabel = 'Sheet',
}: SheetProps) {
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [presented, setPresented] = useState(visible);
  const sheetHeight = useRef(0);
  const translateY = useSharedValue(visible ? 0 : windowHeight);
  const overlayOpacity = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      setPresented(true);
    }
  }, [visible]);

  useEffect(() => {
    if (!presented) {
      return;
    }

    const travel = sheetHeight.current || windowHeight;

    if (visible) {
      if (reduced) {
        overlayOpacity.value = 1;
        translateY.value = 0;
        return;
      }
      overlayOpacity.value = withTiming(1, {
        duration: duration.fast,
        easing: reanimatedEasing,
      });
      if (sheetHeight.current > 0) {
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
      setPresented(false);
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
  }, [overlayOpacity, presented, reduced, translateY, visible, windowHeight]);

  const onSheetLayout = (event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    const firstMeasure = sheetHeight.current === 0;
    sheetHeight.current = nextHeight;

    if (!firstMeasure || !visible) {
      return;
    }

    translateY.value = nextHeight;
    if (reduced) {
      translateY.value = 0;
      return;
    }
    translateY.value = withTiming(0, {
      duration: duration.sheet,
      easing: reanimatedEasing,
    });
  };

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal
      visible={presented}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
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
          className="max-h-[80%] rounded-t-sheet bg-bg px-6 pt-6"
          onLayout={onSheetLayout}
          style={[
            sheetStyle,
            shadows.float,
            {
              paddingBottom: Math.max(insets.bottom, 34),
              borderTopLeftRadius: radii.card,
              borderTopRightRadius: radii.card,
            },
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}
