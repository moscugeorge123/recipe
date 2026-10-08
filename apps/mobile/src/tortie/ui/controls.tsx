import { useState, type ReactNode } from 'react';
import {
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { C, SH, SPRING } from '@/tortie/theme';
import { tw } from '@/tortie/ui/anim';
import { Glyph, Icon } from '@/tortie/ui/icon';
import { Press } from '@/tortie/ui/press';
import { useSheetDrag } from '@/tortie/ui/sheet';
import { ctl, sans, T } from '@/tortie/ui/text';

/** 50×30 switch. Knob 22 at 4px inset, travels 20px (320ms SPRING); track colour 240ms. */
export function Switch({
  value,
  onChange,
  accessibilityLabel,
}: {
  value: boolean;
  onChange: () => void;
  accessibilityLabel?: string;
}) {
  const track = useAnimatedStyle(() => ({
    backgroundColor: tw(value ? C.green : C.line, 240),
  }));
  const knob = useAnimatedStyle(() => ({
    transform: [{ translateX: tw(value ? 20 : 0, 320, SPRING) }],
  }));
  return (
    <Press
      onPress={onChange}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View
        style={[{ width: 50, height: 30, borderRadius: 99 }, track]}
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 4,
              left: 4,
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: C.white,
              boxShadow: SH.knob,
            },
            knob,
          ]}
        />
      </Animated.View>
    </Press>
  );
}

type SegItem = {
  label: string;
  badge?: string;
  badgeOnBg?: string;
  onPress: () => void;
};

/**
 * Two-part segmented control: #edeee9 well, 4px padding, white sliding thumb
 * (translateX 0 ↔ 100%), label colour 300ms. Optional count badges.
 */
export function Segmented({
  items,
  index,
  height = 38,
  thumbMs = 420,
  labelSize = 14,
  style,
}: {
  items: [SegItem, SegItem];
  index: 0 | 1;
  height?: number;
  thumbMs?: number;
  labelSize?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [w, setW] = useState(0);
  const half = Math.max(0, (w - 8) / 2);
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: tw(index ? half : 0, thumbMs) }],
  }));
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          backgroundColor: C.surface3,
          borderRadius: 99,
          padding: 4,
        },
        style,
      ]}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 4,
            bottom: 4,
            left: 4,
            width: half,
            borderRadius: 99,
            backgroundColor: C.white,
            boxShadow: SH.floating,
          },
          thumb,
        ]}
      />
      {items.map((it, i) => (
        <SegButton
          key={it.label}
          item={it}
          on={i === index}
          height={height}
          labelSize={labelSize}
        />
      ))}
    </View>
  );
}

function SegButton({
  item,
  on,
  height,
  labelSize,
}: {
  item: SegItem;
  on: boolean;
  height: number;
  labelSize: number;
}) {
  const label = useAnimatedStyle(() => ({
    color: tw(on ? C.ink : C.ink2, 300),
  }));
  const badge = useAnimatedStyle(() => ({
    backgroundColor: tw(on ? (item.badgeOnBg ?? C.green) : C.line, 300),
  }));
  const badgeText = useAnimatedStyle(() => ({
    color: tw(on ? C.bg : C.ink2, 300),
  }));
  return (
    <Press
      onPress={item.onPress}
      style={{
        flex: 1,
        height,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
      }}
    >
      <Animated.Text
        allowFontScaling={false}
        style={[ctl(labelSize, 700), label]}
      >
        {item.label}
      </Animated.Text>
      {item.badge != null ? (
        <Animated.View
          style={[
            {
              minWidth: 20,
              height: 20,
              paddingHorizontal: 6,
              borderRadius: 99,
              alignItems: 'center',
              justifyContent: 'center',
            },
            badge,
          ]}
        >
          <Animated.Text
            allowFontScaling={false}
            style={[ctl(11, 700), badgeText]}
          >
            {item.badge}
          </Animated.Text>
        </Animated.View>
      ) : null}
    </Press>
  );
}

/**
 * Checkbox: border #c2c8c0 on #f8faf5; checked → #32533c fill with a check
 * that scales 0 → 1 (200ms SPRING). Fill 200ms.
 */
export function Checkbox({
  checked,
  size = 26,
  radius,
  iconSize = 18,
  borderWidth = 2,
  offBg = C.bg,
  offBorder = C.lineStrong,
  style,
}: {
  checked: boolean;
  size?: number;
  radius?: number;
  iconSize?: number;
  borderWidth?: number;
  offBg?: string;
  offBorder?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const box = useAnimatedStyle(() => ({
    backgroundColor: tw(checked ? C.green : offBg, 200),
    borderColor: tw(checked ? C.green : offBorder, 200),
  }));
  const mark = useAnimatedStyle(() => ({
    transform: [{ scale: tw(checked ? 1 : 0, 200, SPRING) }],
  }));
  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius ?? size / 2,
          borderWidth,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
        box,
      ]}
    >
      <Animated.View style={mark}>
        <Glyph name="check" size={iconSize} color={C.white} />
      </Animated.View>
    </Animated.View>
  );
}

type PillProps = {
  label: string;
  on: boolean;
  onPress: () => void;
  icon?: string;
  iconSize?: number;
  height?: number;
  paddingH?: number;
  size?: number;
  weight?: 600 | 700;
  ms?: number;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  children?: ReactNode;
};

/** Selectable pill. Off: white / #e1e3de / ink. On: #32533c / #32533c / #f8faf5. 240ms. Press .95. */
export function Pill({
  label,
  on,
  onPress,
  icon,
  iconSize = 18,
  height = 38,
  paddingH = 14,
  size = 13,
  weight = 600,
  ms = 240,
  style,
  labelStyle,
  children,
}: PillProps) {
  const box = useAnimatedStyle(() => ({
    backgroundColor: tw(on ? C.green : C.white, ms),
    borderColor: tw(on ? C.green : C.line, ms),
  }));
  const txt = useAnimatedStyle(() => ({ color: tw(on ? C.bg : C.ink, ms) }));
  return (
    <Press onPress={onPress} scale={0.95} accessibilityState={{ selected: on }}>
      <Animated.View
        style={[
          {
            height,
            paddingHorizontal: paddingH,
            borderRadius: 99,
            borderWidth: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          },
          style,
          box,
        ]}
      >
        {icon ? (
          <Glyph name={icon} size={iconSize} color={on ? C.bg : C.ink} />
        ) : null}
        <Animated.Text
          allowFontScaling={false}
          style={[ctl(size, weight), labelStyle, txt]}
        >
          {label}
        </Animated.Text>
        {children}
      </Animated.View>
    </Press>
  );
}

/** Bookmark toggle: FILL 0→1 over 300ms, press scale .85 (300ms SPRING). */
export function BookmarkButton({
  saved,
  onPress,
  size = 40,
  iconSize = 20,
  bg = 'rgba(255,255,255,.92)',
  pressScale = 0.85,
  style,
}: {
  saved: boolean;
  onPress: () => void;
  size?: number;
  iconSize?: number;
  bg?: string;
  pressScale?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Press
      onPress={onPress}
      scale={pressScale}
      ms={300}
      easing={SPRING}
      accessibilityLabel={saved ? 'Remove from saved' : 'Save recipe'}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Icon name="bookmark" size={iconSize} color={C.terra} fill={saved} />
    </Press>
  );
}

/** Grab handle at the top of bottom sheets. Drags the parent `Sheet` closed. */
export function Grabber({ mb = 16 }: { mb?: number }) {
  const drag = useSheetDrag();
  const bar = (
    <View
      accessibilityLabel="Drag down to close"
      style={{
        width: 40,
        height: 5,
        borderRadius: 3,
        backgroundColor: C.lineStrong,
        alignSelf: 'center',
        marginBottom: mb,
      }}
    />
  );
  if (!drag) return bar;
  return (
    <GestureDetector gesture={drag}>
      <View
        collapsable={false}
        hitSlop={{ top: 12, bottom: 4 }}
        style={{ alignSelf: 'stretch', width: '100%' }}
      >
        {bar}
      </View>
    </GestureDetector>
  );
}

/** 40px round close button used in sheet headers (#edeee9). */
export function SheetClose({
  onPress,
  size = 40,
  bg = C.surface3,
}: {
  onPress: () => void;
  size?: number;
  bg?: string;
}) {
  return (
    <Press
      onPress={onPress}
      scale={0.9}
      accessibilityLabel="Close"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Glyph name="close" size={20} color={C.ink} />
    </Press>
  );
}

export function Label({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <T
      style={[
        sans(13, 700, C.ink2),
        { marginTop: 22, marginBottom: 10 },
        style,
      ]}
    >
      {children}
    </T>
  );
}
