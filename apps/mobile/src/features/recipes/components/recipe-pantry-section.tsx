import { ShoppingBasket } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { formatQty } from '@/features/recipes/plan';
import type { RecipeIngredientView } from '@/features/recipes/types';
import { colors, fonts } from '@/theme/tokens';

type RecipePantrySectionProps = {
  ingredients: RecipeIngredientView[];
  haveCount: number;
  multiplier: number;
  onAddToGroceries?: () => void;
};

export function RecipePantrySection({
  ingredients,
  haveCount,
  multiplier,
  onAddToGroceries,
}: RecipePantrySectionProps) {
  return (
    <View>
      {onAddToGroceries ? (
        <Button
          label="Add to groceries"
          variant="link"
          onPress={onAddToGroceries}
          icon={
            <ShoppingBasket
              size={18}
              color={colors.paprikaPressed}
              strokeWidth={2}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          }
        />
      ) : null}
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
