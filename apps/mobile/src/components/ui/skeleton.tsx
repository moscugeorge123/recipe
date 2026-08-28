import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { useReducedMotion } from '@/lib/motion';

type SkeletonProps = {
  className?: string;
  height?: number;
  width?: number | `${number}%`;
  radius?: number;
};

export function Skeleton({
  className,
  height = 16,
  width = '100%',
  radius = 12,
}: SkeletonProps) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      return;
    }

    progress.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.linear }),
      -1,
      false,
    );
  }, [progress, reduced]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -80 + progress.value * 280 }],
    opacity: 0.45,
  }));

  return (
    <View
      className={`overflow-hidden bg-linen ${className ?? ''}`}
      style={{ height, width, borderRadius: radius }}
    >
      {reduced ? null : (
        <Animated.View
          className="absolute inset-y-0 w-20 bg-butter"
          style={sweepStyle}
        />
      )}
    </View>
  );
}
