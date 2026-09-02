import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { formatQty } from '@/features/recipes/plan';
import type { RecipeIngredientView } from '@/features/recipes/types';
import { usePopScale } from '@/lib/motion';
import { colors, fonts } from '@/theme/tokens';

const PREVIEW_NEED = 8;

function NeedRow({
  name,
  qty,
  checked,
  onToggle,
  onInfo,
  onAdd,
}: {
  name: string;
  qty: string;
  checked: boolean;
  onToggle: () => void;
  onInfo: () => void;
  onAdd: () => void;
}) {
  const { pop, style } = usePopScale();

  return (
    <View className="min-h-11 flex-row items-center gap-3 border-b border-crust py-3">
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={name}
        onPress={() => {
          pop();
          onToggle();
        }}
        className="h-11 w-11 items-center justify-center"
      >
        <Animated.View
          className="h-[26px] w-[26px] items-center justify-center rounded-[9px] border border-crust"
          style={[
            style,
            { backgroundColor: checked ? colors.basil : colors.butter },
          ]}
        >
          {checked ? <Text tone="inverse">✓</Text> : null}
        </Animated.View>
      </Pressable>
      <Text
        style={{
          minWidth: 70,
          fontFamily: fonts.manrope700,
          color: checked ? colors.olive : colors.espresso,
        }}
      >
        {qty}
      </Text>
      <Pressable className="min-h-11 flex-1 justify-center" onPress={onInfo}>
        <Text
          style={{
            color: checked ? colors.olive : colors.cocoa,
            textDecorationLine: checked ? 'line-through' : 'none',
          }}
        >
          {name}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add ${name}`}
        onPress={onAdd}
        className="h-11 w-11 items-center justify-center rounded-[12px] bg-linen"
      >
        <Text className="text-[15px]" tone="muted">
          +
        </Text>
      </Pressable>
    </View>
  );
}

type RecipePantrySectionProps = {
  have: RecipeIngredientView[];
  need: RecipeIngredientView[];
  servings: number;
  multiplier: number;
  recipeTitle: string;
  checked: Record<string, boolean>;
  onToggle: (id: string) => void;
  onInfo: (title: string, body: string) => void;
  onAddAll: () => void;
  onAddOne: (ingredient: RecipeIngredientView) => void;
};

export function RecipePantrySection({
  have,
  need,
  servings,
  multiplier,
  recipeTitle,
  checked,
  onToggle,
  onInfo,
  onAddAll,
  onAddOne,
}: RecipePantrySectionProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleNeed = expanded ? need : need.slice(0, PREVIEW_NEED);

  return (
    <View>
      {have.length ? (
        <View className="mt-5">
          <Text variant="section">YOU HAVE · {have.length}</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {have.map((ing) => (
              <View
                key={ing.id}
                className="rounded-[12px] bg-secondary-soft px-3 py-2"
              >
                <Text
                  className="max-w-[220px] text-[13px]"
                  style={{ color: colors.basil700 }}
                >
                  {ing.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {need.length ? (
        <View className="mt-5">
          <View className="flex-row items-center justify-between">
            <Text variant="section">TO BUY · {need.length}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add ${need.length} to shopping list`}
              onPress={onAddAll}
              className="min-h-11 justify-center"
            >
              <Text className="text-[13px]" tone="primary">
                Add {need.length} to shopping list
              </Text>
            </Pressable>
          </View>
          {visibleNeed.map((ing) => {
            const on = !!checked[ing.id];
            return (
              <NeedRow
                key={ing.id}
                name={ing.name}
                qty={formatQty(ing.quantity, ing.unit, multiplier)}
                checked={on}
                onToggle={() => onToggle(ing.id)}
                onInfo={() =>
                  onInfo(
                    `${formatQty(ing.quantity, ing.unit, multiplier)} ${ing.name}`,
                    `Shows up in ${ing.category} on your shopping list. Scaled for ${servings} servings of ${recipeTitle}.`,
                  )
                }
                onAdd={() => onAddOne(ing)}
              />
            );
          })}
          {need.length > PREVIEW_NEED ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                expanded
                  ? 'Show fewer ingredients'
                  : `Show all ${need.length} ingredients to buy`
              }
              onPress={() => setExpanded((value) => !value)}
              className="min-h-11 justify-center"
            >
              <Text tone="muted">
                {expanded ? 'Show fewer' : `Show all ${need.length} to buy`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Text
          variant="caption"
          className="mt-4"
          style={{ color: colors.basil700 }}
        >
          You have everything for this one.
        </Text>
      )}
    </View>
  );
}
