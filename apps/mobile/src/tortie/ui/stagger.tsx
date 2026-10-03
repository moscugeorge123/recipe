import { type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useMotion } from '@/tortie/motion';
import { EASE } from '@/tortie/theme';

type StaggerProps = {
  /** Block index i: delay = (70 + i × 55)ms × m. */
  i: number;
  /** Tab/screen active and mounted. Leaving is instant. */
  on: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Stagger entrance: opacity D, translateY 18 → 0 over D × 1.25, both EASE. */
export function Stagger({ i, on, children, style }: StaggerProps) {
  const { D, m } = useMotion();
  const delay = Math.round((70 + i * 55) * m);
  const a = useAnimatedStyle(() => {
    if (!on) return { opacity: 0, transform: [{ translateY: 18 }] };
    return {
      opacity: withDelay(delay, withTiming(1, { duration: D, easing: EASE })),
      transform: [
        {
          translateY: withDelay(
            delay,
            withTiming(0, { duration: Math.round(D * 1.25), easing: EASE }),
          ),
        },
      ],
    };
  }, [on, delay, D]);
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}
