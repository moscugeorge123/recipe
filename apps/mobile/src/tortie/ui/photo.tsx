import { Image } from 'expo-image';
import { useId, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

import { phCaption, stripeA, stripeB } from '@/tortie/color';
import { mono, T } from '@/tortie/ui/text';

type PhotoProps = {
  hue: number;
  /** Real image; the striped placeholder shows underneath until it loads. */
  uri?: string | null;
  /** Mono caption, e.g. "photo · tagliatelle". Hidden when a real image is shown. */
  caption?: string;
  captionSize?: number;
  captionStyle?: StyleProp<ViewStyle>;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/**
 * Photo slot: `repeating-linear-gradient(135deg, A 0 11px, B 11px 22px)` placeholder,
 * with the recipe's real image on top when the API has one.
 */
export function Photo({
  hue,
  uri,
  caption,
  captionSize = 11,
  captionStyle,
  radius = 0,
  style,
  children,
}: PhotoProps) {
  const id = useId().replace(/:/g, '');
  return (
    <View
      style={[
        {
          overflow: 'hidden',
          borderRadius: radius,
          backgroundColor: stripeA(hue),
        },
        style,
      ]}
    >
      <Stripes hue={hue} id={id} />
      {uri ? (
        <Image
          source={{ uri }}
          style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
          contentFit="cover"
          transition={200}
        />
      ) : caption ? (
        <View
          style={[{ position: 'absolute', left: 12, bottom: 10 }, captionStyle]}
          pointerEvents="none"
        >
          <T style={mono(captionSize, phCaption(hue))}>{caption}</T>
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Stripes({ hue, id }: { hue: number; id?: string }) {
  const pid = `st${id ?? hue}`;
  return (
    <Svg
      style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
      width="100%"
      height="100%"
    >
      <Defs>
        <Pattern
          id={pid}
          patternUnits="userSpaceOnUse"
          width={22}
          height={22}
          patternTransform="rotate(45)"
        >
          <Rect x={0} y={0} width={11} height={22} fill={stripeA(hue)} />
          <Rect x={11} y={0} width={11} height={22} fill={stripeB(hue)} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${pid})`} />
    </Svg>
  );
}
