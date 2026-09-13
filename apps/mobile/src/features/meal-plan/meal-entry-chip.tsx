import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import type { MealPlanEntryView } from '@/features/meal-plan/types';
import { slotMeta } from '@/features/meal-plan/week';
import { colors, fonts } from '@/theme/tokens';

type MealEntryChipProps = {
  entry: MealPlanEntryView;
  title: string;
  dragEnabled: boolean;
  onRemove: () => void;
  onDrop: (absoluteX: number, absoluteY: number) => void;
};

export function MealEntryChip({
  entry,
  title,
  dragEnabled,
  onRemove,
  onDrop,
}: MealEntryChipProps) {
  const meta = slotMeta(entry.slot);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const dragging = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
    zIndex: dragging.value ? 20 : 1,
    opacity: dragging.value ? 0.88 : 1,
  }));

  const drag = Gesture.Pan()
    .activateAfterLongPress(400)
    .enabled(dragEnabled)
    .onStart(() => {
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared value
      dragging.value = 1;
    })
    .onUpdate((event) => {
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared value
      translateX.value = event.translationX;
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared value
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      runOnJS(onDrop)(event.absoluteX, event.absoluteY);
    })
    .onFinalize(() => {
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared value
      translateX.value = 0;
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared value
      translateY.value = 0;
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared value
      dragging.value = 0;
    });

  const removeLabel =
    entry.kind === 'NOTE' ? `Remove note ${title}` : `Remove ${title}`;

  const body = (
    <Animated.View style={style} className="mb-2 max-w-full">
      {entry.kind === 'NOTE' ? (
        <View className="bg-paper min-h-11 max-w-full flex-row overflow-hidden rounded-[13px]">
          <View
            style={{ backgroundColor: meta.color, width: 7 }}
            accessibilityElementsHidden
          />
          <View className="min-h-11 flex-1 flex-row items-center gap-2 px-3 py-2">
            <Text
              className="flex-1 text-[13px]"
              style={{ fontFamily: fonts.manrope600 }}
              numberOfLines={2}
            >
              {title}
            </Text>
            <View
              className="rounded-full px-2 py-1"
              style={{ backgroundColor: meta.color }}
            >
              <Text
                className="text-[11px]"
                style={{ fontFamily: fonts.manrope600 }}
              >
                {meta.label}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={removeLabel}
              onPress={onRemove}
              hitSlop={8}
              className="h-11 w-11 items-center justify-center"
            >
              <X size={16} color={colors.espresso} strokeWidth={2.2} />
            </Pressable>
          </View>
        </View>
      ) : (
        <View
          className="min-h-11 max-w-full flex-row items-center rounded-[13px] px-3 py-2"
          style={{ backgroundColor: meta.color }}
        >
          <Text
            className="flex-1 text-[13px]"
            style={{ fontFamily: fonts.manrope600 }}
            numberOfLines={2}
          >
            {title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={removeLabel}
            onPress={onRemove}
            hitSlop={8}
            className="h-11 w-11 items-center justify-center"
          >
            <X size={16} color={colors.espresso} strokeWidth={2.2} />
          </Pressable>
        </View>
      )}
    </Animated.View>
  );

  if (!dragEnabled) {
    return body;
  }

  return <GestureDetector gesture={drag}>{body}</GestureDetector>;
}
