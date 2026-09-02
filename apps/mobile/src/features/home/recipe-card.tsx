import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { SourceIcon } from '@/components/icons/source-icon';
import { PhotoStandIn } from '@/components/ui/photo-stand-in';
import { PressScale } from '@/components/ui/press-scale';
import { Text } from '@/components/ui/text';
import { useRecipeFavorite } from '@/features/recipes/hooks/use-engagement';
import type { RecipeView } from '@/features/recipes/types';
import { usePopScale } from '@/lib/motion';
import { colors } from '@/theme/tokens';

type RecipeCardProps = {
  recipe: RecipeView;
  width?: number;
  photoHeight?: number;
  badge?: string;
  meta?: string;
  showEngagement?: boolean;
};

function cardLabel(recipe: RecipeView): string {
  const bits = [recipe.title];
  const category = recipe.categories?.[0]?.name;
  if (category) bits.push(category);
  if (recipe.isFavorite) bits.push('favorited');
  if (recipe.rating) bits.push(`${recipe.rating} stars`);
  if (recipe.cookCount) bits.push(`cooked ${recipe.cookCount} times`);
  return bits.join(', ');
}

function CardFavorite({ recipe }: { recipe: RecipeView }) {
  const favorite = useRecipeFavorite(recipe);
  const heart = usePopScale();
  const saved = favorite.isFavorite;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove from saved' : 'Save recipe'}
      accessibilityState={{ selected: saved }}
      testID={`recipe-favorite-${recipe.id}`}
      onPress={() => {
        heart.pop();
        favorite.toggle();
      }}
      className="absolute right-1 top-1 items-center justify-center rounded-[14px]"
      style={{
        height: 44,
        width: 44,
        backgroundColor: saved ? colors.berry : 'rgba(255,255,255,0.86)',
      }}
    >
      <Animated.View style={heart.style}>
        <Text tone={saved ? 'inverse' : 'default'}>{saved ? '♥' : '♡'}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function RecipeCard({
  recipe,
  width,
  photoHeight = 118,
  badge,
  meta,
  showEngagement = false,
}: RecipeCardProps) {
  const categories = (recipe.categories ?? []).slice(0, 2);
  const rating = recipe.rating ?? 0;
  const cookCount = recipe.cookCount ?? 0;

  return (
    <View style={width ? { width } : undefined}>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={cardLabel(recipe)}
        testID={`recipe-card-${recipe.id}`}
        onPress={() => router.push(`/recipe/${recipe.id}`)}
      >
        <PhotoStandIn
          colors={recipe.placeholder}
          height={photoHeight}
          radius={16}
          uri={recipe.thumbnailUrl}
          label="photo"
        >
          {badge ? (
            <View
              className="absolute left-2 top-2 h-6 justify-center rounded-lg px-2"
              style={{ backgroundColor: 'rgba(42, 33, 24, 0.8)' }}
            >
              <Text className="text-[9.5px] tracking-[0.06em]" tone="inverse">
                {badge}
              </Text>
            </View>
          ) : null}
        </PhotoStandIn>
        <Text
          className="pt-[11px] text-[15.5px] leading-[1.28]"
          style={{ fontFamily: 'Manrope_700Bold' }}
          numberOfLines={2}
        >
          {recipe.title}
        </Text>
        <View className="flex-row items-center gap-1.5 pt-1">
          <SourceIcon source={recipe.sourceLabel} size={14} />
          <Text variant="caption" className="text-[12px]" numberOfLines={1}>
            {meta ?? recipe.creator}
          </Text>
        </View>
        {showEngagement && (rating > 0 || cookCount > 0) ? (
          <Text
            variant="caption"
            className="pt-0.5 text-[11px]"
            style={{ color: colors.olive }}
            numberOfLines={1}
          >
            {rating > 0 ? `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}` : ''}
            {rating > 0 && cookCount > 0 ? ' · ' : ''}
            {cookCount > 0 ? `${cookCount}× cooked` : ''}
          </Text>
        ) : null}
        {categories.length ? (
          <View className="flex-row flex-wrap gap-1 pt-1.5">
            {categories.map((category) => (
              <View
                key={category.id}
                className="min-h-6 max-w-full justify-center rounded-[8px] bg-peach px-2 py-0.5"
              >
                <Text className="text-[10.5px]" tone="icon">
                  {category.name}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </PressScale>
      <CardFavorite recipe={recipe} />
    </View>
  );
}
