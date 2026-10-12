import { useEffect, useState } from 'react';
import { View, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useMotion } from '@/tortie/motion';
import { EASE } from '@/tortie/theme';
import { T } from '@/tortie/ui/text';

const SLIDE = 10;

/**
 * A caption that stays still until its text changes. The old text then fades
 * and slides up while the new text slides in from below.
 */
export function SlideText({
  children,
  style,
  height,
}: {
  children: string;
  style: StyleProp<TextStyle>;
  /** Line height, so the clipped box fits one line. */
  height: number;
}) {
  const { m } = useMotion();
  const [shown, setShown] = useState({ cur: children, prev: '', n: 0 });
  if (shown.cur !== children) {
    setShown({ cur: children, prev: shown.cur, n: shown.n + 1 });
  }
  const p = useSharedValue(1);
  useEffect(() => {
    if (!shown.n) return;
    p.value = 0;
    p.value = withTiming(1, { duration: Math.round(380 * m), easing: EASE });
  }, [shown.n, m, p]);
  const next = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * SLIDE }],
  }));
  const prev = useAnimatedStyle(() => ({
    opacity: 1 - p.value,
    transform: [{ translateY: -p.value * SLIDE }],
  }));
  return (
    <View style={{ height, overflow: 'hidden' }}>
      {shown.n ? (
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', left: 0, right: 0, top: 0 }, prev]}
        >
          <T numberOfLines={1} style={style}>
            {shown.prev}
          </T>
        </Animated.View>
      ) : null}
      <Animated.View style={next}>
        <T numberOfLines={1} style={style}>
          {shown.cur}
        </T>
      </Animated.View>
    </View>
  );
}
