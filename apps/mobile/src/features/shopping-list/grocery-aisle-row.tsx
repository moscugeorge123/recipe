import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors, fonts } from '@/theme/tokens';

export function GroceryAisleRow({
  emoji,
  name,
  quantityLabel,
  done = false,
  onToggleDone,
  onDelete,
}: {
  emoji: string;
  name: string;
  quantityLabel?: string;
  done?: boolean;
  onToggleDone?: () => void;
  onDelete?: () => void;
}) {
  const row = (
    <View
      className="min-h-11 flex-row items-center gap-3 border-b border-crust py-3"
      style={{ opacity: done ? 0.45 : 1 }}
    >
      <Text
        accessibilityLabel={`${emoji} ${name}`}
        className="w-8 text-center text-[22px]"
      >
        {emoji}
      </Text>
      <View className="min-h-11 flex-1 justify-center">
        <Text
          style={{
            fontFamily: fonts.manrope600,
            textDecorationLine: done ? 'line-through' : 'none',
            color: done ? colors.olive : colors.espresso,
          }}
        >
          {name}
        </Text>
      </View>
      {quantityLabel ? (
        <Text
          variant="caption"
          style={{
            fontFamily: fonts.manrope600,
            color: done ? colors.olive : colors.cocoa,
          }}
        >
          {quantityLabel}
        </Text>
      ) : null}
      {onToggleDone ? (
        <View
          className="h-6 w-6 items-center justify-center rounded-full"
          style={{
            borderWidth: 1.5,
            borderColor: done ? colors.cta : colors.crust,
            backgroundColor: done ? colors.cta : 'transparent',
          }}
        >
          {done ? (
            <Text className="text-[11px]" tone="inverse">
              ✓
            </Text>
          ) : null}
        </View>
      ) : null}
      {onDelete ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${name}`}
          onPress={onDelete}
          className="h-11 justify-center pl-1"
        >
          <Text style={{ color: colors.chili }}>Delete</Text>
        </Pressable>
      ) : null}
    </View>
  );

  if (!onToggleDone) {
    return row;
  }

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={`${done ? 'Uncheck' : 'Check'} ${name}`}
      onPress={onToggleDone}
    >
      {row}
    </Pressable>
  );
}
