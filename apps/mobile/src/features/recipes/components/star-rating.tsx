import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { usePopScale } from '@/lib/motion';
import { colors } from '@/theme/tokens';

function StarButton({
  value,
  filled,
  active,
  onPress,
}: {
  value: number;
  filled: boolean;
  active: boolean;
  onPress: () => void;
}) {
  const { pop, style } = usePopScale();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        active
          ? `${value} stars. Double tap to clear rating`
          : `Rate ${value} star${value === 1 ? '' : 's'}`
      }
      accessibilityState={{ selected: active }}
      onPress={() => {
        pop();
        onPress();
      }}
      className="h-11 w-11 items-center justify-center"
    >
      <Animated.View style={style}>
        <Text
          className="text-[22px]"
          style={{ color: filled ? colors.honey : colors.steam }}
        >
          {filled ? '★' : '☆'}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function StarRatingInput({
  rating,
  onChange,
  disabled,
}: {
  rating: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const current = rating ?? 0;

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={
        current ? `Your rating, ${current} of 5 stars` : 'Your rating, not set'
      }
      accessibilityValue={{ min: 0, max: 5, now: current }}
      className="flex-row items-center"
    >
      {[1, 2, 3, 4, 5].map((value) => (
        <StarButton
          key={value}
          value={value}
          filled={value <= current}
          active={value === current}
          onPress={() => {
            if (!disabled) {
              onChange(value);
            }
          }}
        />
      ))}
    </View>
  );
}
