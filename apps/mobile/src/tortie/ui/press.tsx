import { type ComponentProps, type ReactNode } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type EasingFunction,
} from 'react-native-reanimated';

import { EASE } from '@/tortie/theme';

const APressable = Animated.createAnimatedComponent(Pressable);

type PressProps = Omit<PressableProps, 'style' | 'children'> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Animated style merged after `style` (e.g. from `useAnimatedStyle`). */
  animatedStyle?: ComponentProps<typeof APressable>['style'];
  /** `:active` scale (CSS `style-active`). */
  scale?: number;
  /** `:active` extra rotation in degrees (the + tab button). */
  rotate?: number;
  /** `:active` background colour. */
  pressedBg?: string;
  /** Resting background colour when `pressedBg` is set. */
  bg?: string;
  ms?: number;
  easing?: EasingFunction;
  onPress?: (e: GestureResponderEvent) => void;
};

/**
 * Touch target with the prototype's `:active` feedback (scale / rotate / bg).
 * Nested presses don't bubble: the innermost Press handles the tap.
 */
export function Press({
  children,
  style,
  animatedStyle,
  scale = 1,
  rotate = 0,
  pressedBg,
  bg,
  ms = 200,
  easing = EASE,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: PressProps) {
  const p = useSharedValue(0);
  const a = useAnimatedStyle(() => {
    const s = 1 + (scale - 1) * p.value;
    const out: ViewStyle = {};
    if (scale !== 1 || rotate !== 0) {
      out.transform = [
        { scale: s },
        ...(rotate ? [{ rotate: `${rotate * p.value}deg` }] : []),
      ];
    }
    return out;
  });
  const bgStyle = useAnimatedStyle(() => {
    if (!pressedBg) return {};
    return {
      backgroundColor: p.value > 0.5 ? pressedBg : (bg ?? 'transparent'),
    };
  });
  return (
    <APressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        p.value = withTiming(1, { duration: ms, easing });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        p.value = withTiming(0, { duration: ms, easing });
        onPressOut?.(e);
      }}
      style={[style, animatedStyle, a, pressedBg ? bgStyle : null]}
    >
      {children}
    </APressable>
  );
}
