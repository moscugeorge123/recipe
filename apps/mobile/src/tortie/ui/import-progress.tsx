import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle } from 'react-native-reanimated';

import { plz } from '@/tortie/lib/fmt';
import { C, CSS_EASE, EASE } from '@/tortie/theme';
import { tw } from '@/tortie/ui/anim';
import { Glyph } from '@/tortie/ui/icon';
import { sans, T } from '@/tortie/ui/text';

const STAGES: [
  number,
  (r: { ingCount: number; stepCount: number } | null) => string,
][] = [
  [8, () => 'Reading the page'],
  [
    42,
    (r) =>
      r ? 'Found ' + plz(r.ingCount, 'ingredient') : 'Finding the ingredients',
  ],
  [78, (r) => (r ? 'Wrote ' + plz(r.stepCount, 'step') : 'Writing the steps')],
];

/** The add-sheet import bar: terra fill, stages fade and slide in on EASE. */
export function ImportProgress({
  pct,
  recipe,
  style,
}: {
  pct: number;
  recipe: { ingCount: number; stepCount: number } | null;
  style?: StyleProp<ViewStyle>;
}) {
  const [w, setW] = useState(0);
  const fill = useAnimatedStyle(() => ({
    width: tw((w * pct) / 100, 90, Easing.linear),
  }));
  return (
    <View
      style={[
        {
          marginTop: 20,
          backgroundColor: C.white,
          borderWidth: 1,
          borderColor: C.line,
          borderRadius: 16,
          padding: 18,
        },
        style,
      ]}
    >
      <View
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        style={{
          height: 6,
          backgroundColor: C.surface3,
          borderRadius: 9,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[
            { height: '100%', backgroundColor: C.terra, borderRadius: 9 },
            fill,
          ]}
        />
      </View>
      <View style={{ gap: 12, marginTop: 16 }}>
        {STAGES.map(([at, label]) => (
          <StageRow
            key={at}
            on={pct >= at}
            done={pct >= at + 20}
            label={label(recipe)}
          />
        ))}
      </View>
    </View>
  );
}

function StageRow({
  on,
  done,
  label,
}: {
  on: boolean;
  done: boolean;
  label: string;
}) {
  const a = useAnimatedStyle(() => ({
    opacity: tw(on ? 1 : 0.3, 300, CSS_EASE),
    transform: [{ translateX: tw(on ? 0 : -6, 400, EASE) }],
  }));
  return (
    <Animated.View
      style={[{ flexDirection: 'row', alignItems: 'center', gap: 10 }, a]}
    >
      <Glyph
        name={done ? 'check_circle' : 'progress_activity'}
        size={20}
        color={done ? C.green : C.terra}
      />
      <T style={sans(14, 600)}>{label}</T>
    </Animated.View>
  );
}
