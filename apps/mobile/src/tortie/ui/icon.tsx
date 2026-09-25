import { useEffect } from 'react';
import {
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { F } from '@/tortie/theme';

/**
 * Material Symbols Outlined, rendered by ligature (icon name as text).
 * React Native can't animate the FILL axis, so `fill` cross-fades two static fonts.
 */
type IconProps = {
  name: string;
  size?: number;
  color?: string;
  fill?: boolean;
  /** Animate FILL changes over this many ms (default 300). 0 = instant. */
  fillMs?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function Icon({
  name,
  size = 24,
  color = '#191c19',
  fill = false,
  fillMs = 300,
  style,
  textStyle,
}: IconProps) {
  const p = useSharedValue(fill ? 1 : 0);
  useEffect(() => {
    p.value = fillMs
      ? withTiming(fill ? 1 : 0, { duration: fillMs })
      : fill
        ? 1
        : 0;
  }, [fill, fillMs, p]);
  const outline = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  const filled = useAnimatedStyle(() => ({ opacity: p.value }));
  const glyph: TextStyle = {
    fontSize: size,
    lineHeight: size,
    width: size,
    height: size,
    color,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  };
  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none">
      <Animated.View
        style={[{ position: 'absolute', left: 0, top: 0 }, outline]}
      >
        <Text
          allowFontScaling={false}
          style={[glyph, { fontFamily: F.icon }, textStyle]}
        >
          {name}
        </Text>
      </Animated.View>
      <Animated.View
        style={[{ position: 'absolute', left: 0, top: 0 }, filled]}
      >
        <Text
          allowFontScaling={false}
          style={[glyph, { fontFamily: F.iconFill }, textStyle]}
        >
          {name}
        </Text>
      </Animated.View>
    </View>
  );
}

/** Static icon without the fill cross-fade (cheaper for long lists). */
export function Glyph({
  name,
  size = 24,
  color = '#191c19',
  fill = false,
  style,
}: Omit<IconProps, 'fillMs' | 'textStyle'> & { style?: StyleProp<TextStyle> }) {
  return (
    <Text
      allowFontScaling={false}
      style={[
        {
          fontFamily: fill ? F.iconFill : F.icon,
          fontSize: size,
          lineHeight: size,
          width: size,
          height: size,
          color,
          textAlign: 'center',
          textAlignVertical: 'center',
          includeFontPadding: false,
        },
        style,
      ]}
    >
      {name}
    </Text>
  );
}
