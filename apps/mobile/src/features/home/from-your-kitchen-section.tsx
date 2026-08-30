import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { SectionLabel } from '@/components/ui/section-label';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useCatalog } from '@/features/catalog/use-catalog';
import { colors, fonts } from '@/theme/tokens';

export function FromYourKitchenSection() {
  const catalog = useCatalog();
  const pantry = catalog.pantryMatches
    .filter((row) => row.total > 0)
    .sort((a, b) => b.have / b.total - a.have / a.total)
    .slice(0, 3);

  return (
    <View className="mx-5 rounded-[20px] border border-crust bg-linen p-[18px]">
      <SectionLabel>FROM YOUR KITCHEN</SectionLabel>
      <Text variant="caption" className="py-2">
        You marked chickpeas, spinach and lemon as in stock.
      </Text>
      {catalog.isApiLoading && !pantry.length ? (
        <Skeleton height={64} />
      ) : (
        pantry.map((row) => (
          <Pressable
            key={row.recipe.id}
            accessibilityRole="button"
            accessibilityLabel={row.recipe.title}
            onPress={() => router.push(`/recipe/${row.recipe.id}`)}
            className="min-h-11 flex-row items-center gap-[13px] border-t border-crust py-[11px]"
          >
            <View
              className="h-[46px] w-[46px] items-center justify-center rounded-[14px]"
              style={{
                backgroundColor:
                  row.gap === 'everything in stock'
                    ? colors.basilSoft
                    : colors.paprikaSoft,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.mono700,
                  fontSize: 12.5,
                  color:
                    row.gap === 'everything in stock'
                      ? colors.basil700
                      : colors.paprika,
                }}
              >
                {row.have}/{row.total}
              </Text>
            </View>
            <View className="flex-1">
              <Text
                className="text-[15px]"
                style={{ fontFamily: fonts.manrope700 }}
              >
                {row.recipe.title}
              </Text>
              <Text variant="caption" className="pt-1 text-[12.5px]">
                {row.gap}
              </Text>
            </View>
            <Text className="text-[20px]" tone="disabled">
              ›
            </Text>
          </Pressable>
        ))
      )}
    </View>
  );
}
