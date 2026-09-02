import type { ReactNode } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { duration, PRESS_SCALE, useReducedMotion } from '@/lib/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressScaleProps = Omit<PressableProps, 'style'> & {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

export function PressScale({
  children,
  disabled,
  onPressIn,
  onPressOut,
  className,
  style,
  ...props
}: PressScaleProps) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      className={className}
      disabled={disabled}
      style={[animatedStyle, style]}
      onPressIn={(event) => {
        if (!reduced && !disabled) {
          // Reanimated shared values are mutated by design.
          // eslint-disable-next-line react-hooks/immutability
          scale.value = withTiming(PRESS_SCALE, { duration: duration.instant });
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        // eslint-disable-next-line react-hooks/immutability
        scale.value = withTiming(1, { duration: duration.fast });
        onPressOut?.(event);
      }}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}
