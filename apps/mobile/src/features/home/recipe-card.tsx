import { View } from 'react-native';
import { router } from 'expo-router';

import { SourceIcon } from '@/components/icons/source-icon';
import { PhotoStandIn } from '@/components/ui/photo-stand-in';
import { PressScale } from '@/components/ui/press-scale';
import { Text } from '@/components/ui/text';
import type { RecipeView } from '@/features/recipes/types';

type RecipeCardProps = {
  recipe: RecipeView;
  width?: number;
  photoHeight?: number;
  badge?: string;
  meta?: string;
};

export function RecipeCard({
  recipe,
  width,
  photoHeight = 118,
  badge,
  meta,
}: RecipeCardProps) {
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={recipe.title}
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      style={width ? { width } : undefined}
    >
      <View>
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
          <Text variant="caption" className="text-[12px]">
            {meta ?? `${recipe.sourceLabel} · ${recipe.creator}`}
          </Text>
        </View>
      </View>
    </PressScale>
  );
}
