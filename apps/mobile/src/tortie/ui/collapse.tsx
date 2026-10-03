import { useState, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type EasingFunction,
} from 'react-native-reanimated';

import { tw } from '@/tortie/ui/anim';
import { CSS_EASE, EASE } from '@/tortie/theme';

type CollapseProps = {
  open: boolean;
  children: ReactNode;
  /** Height transition (CSS max-height 0 ↔ content). */
  ms?: number;
  easing?: EasingFunction;
  /** Opacity transition. */
  opacityMs?: number;
  opacityEasing?: EasingFunction;
  style?: StyleProp<ViewStyle>;
};

/** Animates height between 0 and the measured content height. */
export function Collapse({
  open,
  children,
  ms = 420,
  easing = EASE,
  opacityMs = 260,
  opacityEasing = CSS_EASE,
  style,
}: CollapseProps) {
  const [h, setH] = useState(-1);
  const a = useAnimatedStyle(() => ({
    height: h < 0 ? (open ? undefined : 0) : tw(open ? h : 0, ms, easing),
    opacity: tw(open ? 1 : 0, opacityMs, opacityEasing),
  }));
  return (
    <Animated.View style={[{ overflow: 'hidden' }, style, a]}>
      <View
        style={{
          position: h < 0 && !open ? 'absolute' : 'relative',
          left: 0,
          right: 0,
        }}
        onLayout={(e) => {
          const v = Math.round(e.nativeEvent.layout.height);
          if (v !== h) setH(v);
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
}
