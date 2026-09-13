import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { formatQty } from '@/features/recipes/plan';
import type { RecipeIngredientView } from '@/features/recipes/types';
import { fonts } from '@/theme/tokens';

type RecipePantrySectionProps = {
  ingredients: RecipeIngredientView[];
  haveCount: number;
  multiplier: number;
};

export function RecipePantrySection({
  ingredients,
  haveCount,
  multiplier,
}: RecipePantrySectionProps) {
  return (
    <View>
      {haveCount > 0 ? (
        <Text variant="caption" className="pt-1">
          {haveCount} already in Pantry
        </Text>
      ) : null}
      {ingredients.map((ing) => (
        <View
          key={ing.id}
          className="min-h-11 flex-row items-center gap-3 border-b border-crust py-3"
        >
          <Text className="w-7 text-center text-[16px]">
            {ing.emoji ?? '•'}
          </Text>
          <Text
            className="min-w-[70px]"
            style={{ fontFamily: fonts.manrope700 }}
          >
            {formatQty(ing.quantity, ing.unit, multiplier)}
          </Text>
          <Text className="flex-1">{ing.name}</Text>
        </View>
      ))}
    </View>
  );
}
