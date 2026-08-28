import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { PhotoStandIn } from '@/components/ui/photo-stand-in';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useRecipe } from '@/features/recipes/hooks/use-recipe';
import { formatQty } from '@/features/recipes/plan';
import { inboxStatusForRecipe } from '@/stores/contracts';
import { useKitchenStore } from '@/stores/kitchen-store';
import { useUiStore } from '@/stores/ui-store';
import { colors, fonts } from '@/theme/tokens';

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: recipe, isLoading } = useRecipe(id);
  const markInbox = useKitchenStore((state) => state.markInbox);
  const showToast = useUiStore((state) => state.showToast);

  if (!recipe) {
    return (
      <Screen className="px-5">
        <Text variant="display">
          {isLoading ? 'Loading…' : 'Recipe missing'}
        </Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="px-5 pb-10"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          className="-ml-[11px] mb-1 h-11 w-11 items-center justify-center"
        >
          <Text className="text-[22px]" tone="icon">
            ‹
          </Text>
        </Pressable>
        <View className="mb-4 h-8 flex-row items-center gap-2 self-start rounded-[11px] bg-secondary-soft px-[13px]">
          <Text className="text-[13px]" style={{ color: colors.basil700 }}>
            ✓
          </Text>
          <Text className="text-[13px]" style={{ color: colors.basil700 }}>
            Recipe built · {recipe.ingredients.length} ingredients,{' '}
            {recipe.steps.length} steps
          </Text>
        </View>
        <View className="overflow-hidden rounded-[22px] border border-crust bg-bg-elevated">
          <PhotoStandIn
            colors={recipe.placeholder}
            height={170}
            radius={0}
            uri={recipe.thumbnailUrl}
            label="photo — from the video"
          />
          <View className="p-[18px]">
            <View className="flex-row items-start gap-2.5">
              <Text variant="title" className="flex-1">
                {recipe.title}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  showToast({
                    text: 'Every field is editable here',
                    glyph: '✎',
                  })
                }
                className="h-[34px] justify-center rounded-[11px] bg-peach px-3"
              >
                <Text className="text-[12.5px]" tone="muted">
                  Edit
                </Text>
              </Pressable>
            </View>
            <View className="flex-row flex-wrap gap-2 py-4">
              {[
                { k: 'TIME', v: `${recipe.minutes} min` },
                { k: 'EFFORT', v: recipe.difficulty },
                { k: 'SERVES', v: String(recipe.servings) },
              ].map((meta) => (
                <View
                  key={meta.k}
                  className="rounded-[12px] bg-linen px-[13px] py-2"
                >
                  <Text variant="mono" className="text-[10px]">
                    {meta.k}
                  </Text>
                  <Text
                    style={{ fontFamily: fonts.manrope700 }}
                    className="pt-1 text-[14.5px]"
                  >
                    {meta.v}
                  </Text>
                </View>
              ))}
            </View>
            {recipe.ingredients.slice(0, 4).map((ing) => (
              <View
                key={ing.id}
                className="flex-row gap-3 border-t border-crust py-3"
              >
                <Text
                  style={{ fontFamily: fonts.manrope700 }}
                  className="w-[70px]"
                >
                  {formatQty(ing.quantity, ing.unit)}
                </Text>
                <Text className="flex-1" tone="icon">
                  {ing.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <Button
          label="Looks good — save it"
          size="lg"
          className="mt-5"
          onPress={() => {
            markInbox(recipe.id, inboxStatusForRecipe(recipe));
            showToast({
              text: 'Recipe ready · in your Inbox',
              glyph: '♥',
              action: 'Cook it',
              onAction: () => router.push(`/cook/${recipe.id}`),
            });
            router.replace(`/recipe/${recipe.id}`);
          }}
        />
        <Button
          label="Review every field"
          variant="ghost"
          onPress={() =>
            showToast({ text: 'Every field is editable here', glyph: '✎' })
          }
        />
      </ScrollView>
    </Screen>
  );
}
