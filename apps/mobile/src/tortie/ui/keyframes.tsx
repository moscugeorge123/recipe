import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import {
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { C, EASE_IN_OUT, EASE_OUT, SPRING } from '@/tortie/theme';
import { Glyph } from '@/tortie/ui/icon';
import { T } from '@/tortie/ui/text';

/** Looping 0→1 progress. */
function useLoop(ms: number, delayMs = 0, easing = Easing.linear) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = 0;
    p.value = withDelay(
      delayMs,
      withRepeat(withTiming(1, { duration: ms, easing }), -1, false),
    );
    return () => cancelAnimation(p);
  }, [ms, delayMs, easing, p]);
  return p;
}

/** "Cooking now" dot: halo scale 1→2.8, opacity .55→0, 1.6s ease-out ∞. */
export function PulseDot({
  size = 8,
  color = C.terra,
  ms = 1600,
  delay = 0,
}: {
  size?: number;
  color?: string;
  ms?: number;
  delay?: number;
}) {
  const p = useLoop(ms, delay, EASE_OUT);
  const halo = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - p.value),
    transform: [{ scale: 1 + 1.8 * p.value }],
  }));
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            top: 0,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
          halo,
        ]}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** Pulse halo behind arbitrary content (Done art). */
export function PulseHalo({
  size,
  color,
  ms = 2000,
  delay = 0,
  style,
}: {
  size: number;
  color: string;
  ms?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const p = useLoop(ms, delay, EASE_OUT);
  const a = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - p.value),
    transform: [{ scale: 1 + 1.8 * p.value }],
  }));
  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
        a,
      ]}
    />
  );
}

export function Spin({
  ms = 1400,
  children,
  style,
}: {
  ms?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const p = useLoop(ms);
  const a = useAnimatedStyle(() => ({
    transform: [{ rotate: `${p.value * 360}deg` }],
  }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** scale .8→1.12→.8, opacity .65→1→.65. */
export function Twinkle({
  ms = 1800,
  delay = 0,
  children,
  style,
}: {
  ms?: number;
  delay?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const p = useLoop(ms, delay, Easing.linear);
  const a = useAnimatedStyle(() => {
    const k =
      p.value < 0.5 ? EASE_IN_OUT(p.value * 2) : EASE_IN_OUT((1 - p.value) * 2);
    return { opacity: 0.65 + 0.35 * k, transform: [{ scale: 0.8 + 0.32 * k }] };
  });
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** Floating emoji tile: translateY 0 → −7 → 0, 3.8s ease-in-out ∞. */
export function Float({
  ms = 3800,
  delay = 0,
  children,
  style,
}: {
  ms?: number;
  delay?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: ms / 2, easing: EASE_IN_OUT }),
          withTiming(0, { duration: ms / 2, easing: EASE_IN_OUT }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(p);
  }, [ms, delay, p]);
  const a = useAnimatedStyle(() => ({
    transform: [{ translateY: -7 * p.value }],
  }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** Pop in once: scale .2 rotate −25°, opacity 0 → rest (SPRING). */
export function Pop({
  ms = 560,
  children,
  style,
}: {
  ms?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: ms, easing: SPRING });
  }, [ms, p]);
  const a = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.value),
    transform: [
      { scale: 0.2 + 0.8 * p.value },
      { rotate: `${-25 * (1 - p.value)}deg` },
    ],
  }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

function Dot({
  i,
  children,
  style,
}: {
  i: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      i * 200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 600, easing: EASE_IN_OUT }),
          withTiming(0, { duration: 600, easing: EASE_IN_OUT }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(p);
  }, [i, p]);
  const a = useAnimatedStyle(() => ({ opacity: 0.25 + 0.75 * p.value }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** Animated "…" after staged captions. */
export function Dots({ textStyle }: { textStyle?: StyleProp<TextStyle> }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2, marginLeft: 1 }}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} i={i}>
          <T style={textStyle}>.</T>
        </Dot>
      ))}
    </View>
  );
}

/** Round dots (OAuth art). */
export function DotRow({
  size = 7,
  color = C.green,
  gap = 6,
}: {
  size?: number;
  color?: string;
  gap?: number;
}) {
  return (
    <View style={{ flexDirection: 'row', gap }}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} i={i}>
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
            }}
          />
        </Dot>
      ))}
    </View>
  );
}

const CONIC = ['#c7ecce', '#fe8357', '#ffdbcf', '#ACCFB1', '#c7ecce'];

function lerpHex(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa
    .map((v, k) =>
      Math.round(v + ((pb[k] ?? 0) - v) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** conic-gradient(from 0deg, #c7ecce, #fe8357, #ffdbcf, #ACCFB1, #c7ecce) as SVG wedges. */
export function Conic({ size }: { size: number }) {
  const N = 72;
  const r = size / 2;
  const paths = [];
  for (let k = 0; k < N; k++) {
    const t = k / N;
    const seg = t * (CONIC.length - 1);
    const j = Math.floor(seg);
    const col = lerpHex(
      CONIC[j]!,
      CONIC[Math.min(j + 1, CONIC.length - 1)]!,
      seg - j,
    );
    const a0 = (t * 360 - 90 - 0.6) * (Math.PI / 180);
    const a1 = (((k + 1) / N) * 360 - 90 + 0.6) * (Math.PI / 180);
    paths.push(
      <Path
        key={k}
        d={`M${r},${r} L${r + r * Math.cos(a0)},${r + r * Math.sin(a0)} A${r},${r} 0 0 1 ${r + r * Math.cos(a1)},${r + r * Math.sin(a1)} Z`}
        fill={col}
      />,
    );
  }
  return (
    <Svg width={size} height={size}>
      {paths}
    </Svg>
  );
}

/**
 * AI orb: a spinning conic ring (inset −40%, 1.4s linear) behind an inner tile
 * with a twinkling `auto_awesome`.
 */
export function Orb({
  size = 40,
  radius = 12,
  inset = 2,
  innerBg = '#fbfcf8',
  children,
}: {
  size?: number;
  radius?: number;
  inset?: number;
  innerBg?: string;
  children?: ReactNode;
}) {
  const big = size * 1.8;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: 'hidden',
      }}
    >
      <Spin
        ms={1400}
        style={{
          position: 'absolute',
          left: -size * 0.4,
          top: -size * 0.4,
          width: big,
          height: big,
        }}
      >
        <Conic size={big} />
      </Spin>
      <View
        style={{
          position: 'absolute',
          left: inset,
          top: inset,
          right: inset,
          bottom: inset,
          borderRadius: radius - inset,
          backgroundColor: innerBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children ?? (
          <Twinkle ms={1100}>
            <Glyph name="auto_awesome" size={20} color={C.terra} fill />
          </Twinkle>
        )}
      </View>
    </View>
  );
}

/** 20px ring spinner used inside busy buttons. */
export function ButtonSpinner({
  size = 20,
  color = '#f8faf5',
  track = 'rgba(248,250,245,.35)',
}: {
  size?: number;
  color?: string;
  track?: string;
}) {
  return (
    <Spin ms={800} style={{ width: size, height: size }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2.5,
          borderColor: track,
          borderTopColor: color,
        }}
      />
    </Spin>
  );
}

/**
 * Text being processed: `#191c19 38% → #c2c8c0 50% → #191c19 62%`, size 250%,
 * background-position 130% → −130% over 1.6s linear ∞, clipped to the text.
 */
export function ShimmerText({
  children,
  style,
}: {
  children: string;
  style: StyleProp<TextStyle>;
}) {
  const [w, setW] = useState(0);
  const p = useLoop(1600);
  const gw = Math.max(1, w) * 2.5;
  const a = useAnimatedStyle(() => {
    // CSS background-position x% maps offset = (w − gw) × x.
    const x = 1.3 - 2.6 * p.value;
    return { transform: [{ translateX: (w - gw) * x }] };
  });
  return (
    <MaskedView
      style={{ flexDirection: 'row' }}
      maskElement={
        <T
          style={style}
          numberOfLines={1}
          onLayout={(e) => setW(e.nativeEvent.layout.width)}
        >
          {children}
        </T>
      }
    >
      <T style={[style, { opacity: 0 }]} numberOfLines={1}>
        {children}
      </T>
      <Animated.View
        style={[
          { position: 'absolute', left: 0, top: 0, bottom: 0, width: gw },
          a,
        ]}
      >
        <LinearGradient
          colors={[C.ink, C.ink, C.lineStrong, C.ink, C.ink]}
          locations={[0, 0.38, 0.5, 0.62, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </MaskedView>
  );
}
