import { useEffect } from 'react';
import { View, type DimensionValue } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { daisy } from '@/components/daisy/colors';
import { DaisyFoodGlyph } from '@/components/daisy/foods';
import {
  DAISY_CHIP_BAND,
  THEATER_CHIPS,
  type DaisyPhase,
} from '@/components/daisy/phase';
import { Text } from '@/components/ui/text';
import { typeface } from '@/theme/tokens';

const spring = Easing.bezier(0.34, 1.56, 0.64, 1);

type DaisyCardsProps = {
  phase: DaisyPhase;
  reducedMotion: boolean;
  focus: number;
};

export function DaisyCards({ phase, reducedMotion, focus }: DaisyCardsProps) {
  const visible =
    phase === 'analyzing' || phase === 'processing' || phase === 'success';
  const showQty = phase === 'processing' || phase === 'success';

  if (!visible) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      testID="daisy-cards"
      style={{ height: DAISY_CHIP_BAND }}
    >
      {THEATER_CHIPS.map((chip, index) => (
        <DaisyChip
          key={chip.id}
          name={chip.name}
          qty={chip.qty}
          food={chip.id}
          left={chip.x}
          top={chip.y}
          index={index}
          focused={focus === index}
          showQty={showQty}
          checked={phase === 'success'}
          reducedMotion={reducedMotion}
        />
      ))}
    </View>
  );
}

function DaisyChip({
  name,
  qty,
  food,
  left,
  top,
  index,
  focused,
  showQty,
  checked,
  reducedMotion,
}: {
  name: string;
  qty: string;
  food: (typeof THEATER_CHIPS)[number]['id'];
  left: DimensionValue;
  top: number;
  index: number;
  focused: boolean;
  showQty: boolean;
  checked: boolean;
  reducedMotion: boolean;
}) {
  const enter = useSharedValue(reducedMotion ? 1 : 0);
  const float = useSharedValue(0);
  const qtyOn = useSharedValue(showQty ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      enter.value = 1;
      float.value = 0;
      qtyOn.value = showQty ? 1 : 0;
      return;
    }
    enter.value = withDelay(
      index * 120,
      withTiming(1, { duration: 500, easing: spring }),
    );
    float.value = withDelay(
      index * 600,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: (3000 + index * 500) / 2,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0, {
            duration: (3000 + index * 500) / 2,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        false,
      ),
    );
    qtyOn.value = withTiming(showQty ? 1 : 0, { duration: 450 });
  }, [enter, float, index, qtyOn, reducedMotion, showQty]);

  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateY: (1 - enter.value) * 12 + float.value * -7 },
      { scale: 0.9 + enter.value * 0.1 },
    ],
  }));

  const qtyStyle = useAnimatedStyle(() => ({
    maxWidth: qtyOn.value * 64,
    opacity: qtyOn.value,
    overflow: 'hidden' as const,
  }));

  return (
    <View style={{ position: 'absolute', left, top }}>
      <Animated.View
        testID={`daisy-card-${food}`}
        style={[
          style,
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 14,
            backgroundColor: daisy.chip,
            shadowColor: daisy.ink,
            shadowOpacity: 0.1,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            elevation: 3,
            borderWidth: focused ? 2 : 0,
            borderColor: daisy.apron,
          },
        ]}
      >
        <DaisyFoodGlyph id={food} size={20} />
        <Text
          style={{
            ...typeface('semibold'),
            fontSize: 13,
            color: daisy.chipText,
          }}
        >
          {name}
        </Text>
        <Animated.View style={qtyStyle}>
          <Text
            numberOfLines={1}
            style={{
              ...typeface('semibold'),
              fontSize: 13,
              color: daisy.apron,
            }}
          >
            {qty}
          </Text>
        </Animated.View>
        {checked ? (
          <View
            style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: daisy.success,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: daisy.highlight,
                fontSize: 10,
                ...typeface('semibold'),
              }}
            >
              ✓
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}
