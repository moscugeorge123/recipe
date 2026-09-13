import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { MealSlot } from '@/features/meal-plan/types';
import { MEAL_SLOTS } from '@/features/meal-plan/week';
import { colors, fonts } from '@/theme/tokens';

type SlotPopoverProps = {
  onPick: (slot: MealSlot) => void;
};

export function SlotPopover({ onPick }: SlotPopoverProps) {
  return (
    <View
      className="overflow-hidden rounded-[16px] bg-bg"
      style={{
        borderWidth: 1,
        borderColor: colors.crust,
        minWidth: 148,
      }}
      accessibilityRole="menu"
      accessibilityLabel="Choose a meal"
    >
      {MEAL_SLOTS.map((item, index) => (
        <Pressable
          key={item.slot}
          accessibilityRole="menuitem"
          accessibilityLabel={item.label}
          onPress={() => onPick(item.slot)}
          className={`min-h-11 flex-row items-center gap-2.5 px-3.5 py-2.5 ${
            index < MEAL_SLOTS.length - 1 ? 'border-b border-crust' : ''
          }`}
        >
          <Text className="text-[16px]">{item.emoji}</Text>
          <Text style={{ fontFamily: fonts.manrope600 }}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
