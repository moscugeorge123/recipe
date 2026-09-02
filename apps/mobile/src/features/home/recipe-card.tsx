import { router } from 'expo-router';
import { View } from 'react-native';

import { SourceIcon } from '@/components/icons/source-icon';
import { PhotoStandIn } from '@/components/ui/photo-stand-in';
import { PressScale } from '@/components/ui/press-scale';
import { Text } from '@/components/ui/text';
import type { RecipeView } from '@/features/recipes/types';
import { colors, fonts, radii, shadows } from '@/theme/tokens';

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
        <View style={shadows.float}>
          <PhotoStandIn
            colors={recipe.placeholder}
            height={photoHeight}
            radius={radii.card}
            uri={recipe.thumbnailUrl}
            label="photo"
          >
            {badge ? (
              <View
                className="absolute left-2 top-2 h-6 justify-center px-2.5"
                style={{
                  backgroundColor: colors.cream,
                  borderRadius: radii.pill,
                  ...shadows.float,
                }}
              >
                <Text
                  className="text-[11px] leading-[13px]"
                  style={{
                    fontFamily: fonts.semibold,
                    color: colors.espresso,
                  }}
                >
                  {badge}
                </Text>
              </View>
            ) : null}
          </PhotoStandIn>
        </View>
        <Text
          className="pt-4 text-base leading-5"
          style={{ fontFamily: fonts.semibold }}
          numberOfLines={2}
        >
          {recipe.title}
        </Text>
        <View className="flex-row items-center gap-1.5 pt-1">
          <SourceIcon source={recipe.sourceLabel} size={14} />
          <Text variant="caption" className="text-sm">
            {meta ?? `${recipe.creator}`}
          </Text>
        </View>
      </View>
    </PressScale>
  );
}
