import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { SourceIcon } from '@/components/icons/source-icon';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { IconButton } from '@/components/ui/icon-button';
import { PhotoStandIn } from '@/components/ui/photo-stand-in';
import { Screen } from '@/components/ui/screen';
import { SectionLabel } from '@/components/ui/section-label';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useCatalog } from '@/features/catalog/use-catalog';
import { RecipeCard } from '@/features/home/recipe-card';
import { useRecipe } from '@/features/recipes/hooks/use-recipe';
import { useCookStore } from '@/stores/cook-store';
import { useKitchenStore } from '@/stores/kitchen-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import { colors, fonts } from '@/theme/tokens';

function formatKicker(now = new Date()): string {
  const weekday = now
    .toLocaleDateString('en-GB', { weekday: 'long' })
    .toUpperCase();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${weekday} · ${hours}:${minutes}`;
}

function greetingHour(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) {
    return 'Morning';
  }
  if (hour < 17) {
    return 'Afternoon';
  }
  return 'Evening';
}

export default function HomeScreen() {
  const displayName = usePreferencesStore((state) => state.displayName);
  const firstName = displayName.split(' ')[0] ?? displayName;
  const catalog = useCatalog();
  const cookRecipeId = useCookStore((state) => state.recipeId);
  const stepIndex = useCookStore((state) => state.stepIndex);
  const inboxStatus = useKitchenStore((state) => state.inboxStatus);
  const [mood, setMood] = useState<'quick' | 'comfort' | 'fresh' | null>(null);

  const fetchedCooking = useRecipe(cookRecipeId ?? undefined);
  const cooking =
    fetchedCooking.data ??
    (cookRecipeId ? catalog.get(cookRecipeId) : undefined);
  const inboxItems = catalog.inbox;

  const greetLine = cooking
    ? "Dinner's underway."
    : inboxItems.length
      ? "Something's ready for you."
      : 'What are we cooking?';

  const tonight = useMemo(() => {
    const pick = {
      quick: ['seed:pistachio', 'seed:gnocchi'],
      comfort: ['seed:harissa', 'seed:dal'],
      fresh: ['seed:galette', 'seed:congee'],
    };
    const why = {
      quick: 'UNDER 30 MINUTES',
      comfort: 'SLOW AND EASY',
      fresh: 'LIGHT TONIGHT',
    };
    const ids = mood ? pick[mood] : ['seed:harissa'];
    const recipe =
      catalog.get(ids.find((id) => !inboxStatus[id]) ?? ids[0] ?? '') ??
      catalog.recipes[0];
    return {
      recipe,
      why: mood ? why[mood] : 'YOU HAVE MOST OF THIS',
    };
  }, [catalog, inboxStatus, mood]);

  const pantry = catalog.pantryMatches
    .filter((row) => row.total > 0)
    .sort((a, b) => b.have / b.total - a.have / a.total)
    .slice(0, 3);

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-8"
      >
        <View className="flex-row items-start justify-between px-5 pb-[18px] pt-1">
          <View className="flex-1 pr-3">
            <Text variant="mono">{formatKicker()}</Text>
            <Text variant="display" accessibilityRole="header" className="pt-2">
              {greetingHour()}, {firstName}.{'\n'}
              {greetLine}
            </Text>
          </View>
          <IconButton
            accessibilityLabel="Search recipes"
            onPress={() => router.push('/search')}
          >
            <View className="h-[15px] w-[15px]">
              <View className="h-2.5 w-2.5 rounded-full border-2 border-olive" />
              <View className="absolute bottom-0 right-0 h-1.5 w-0.5 rotate-45 rounded-sm bg-olive" />
            </View>
          </IconButton>
        </View>

        {cooking ? (
          <View
            className="mx-5 mb-[26px] rounded-[20px] p-4"
            style={{ backgroundColor: colors.espresso }}
          >
            <Text
              className="text-[10.5px] tracking-[0.14em]"
              tone="accent"
              style={{ fontFamily: fonts.mono500 }}
            >
              COOKING NOW
            </Text>
            <Text
              tone="inverse"
              className="pt-2 text-[18px]"
              style={{ fontFamily: fonts.manrope800 }}
            >
              {cooking.title}
            </Text>
            <Text className="pt-1 text-[12.5px]" style={{ color: '#B5A898' }}>
              Step {stepIndex + 1} of {cooking.steps.length}
            </Text>
            <View className="flex-row gap-1 py-3">
              {cooking.steps.map((step, index) => (
                <View
                  key={step.id}
                  className="h-[5px] flex-1 rounded-full"
                  style={{
                    backgroundColor:
                      index <= stepIndex
                        ? colors.paprika
                        : 'rgba(255,255,255,0.16)',
                  }}
                />
              ))}
            </View>
            <Button
              label="Resume"
              size="md"
              onPress={() => router.push(`/cook/${cooking.id}/step`)}
            />
          </View>
        ) : null}

        {inboxItems.length ? (
          <View>
            <View className="flex-row items-baseline justify-between px-5 pb-3">
              <SectionLabel>{`RECIPE INBOX · ${inboxItems.length}`}</SectionLabel>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="See all inbox"
                onPress={() => router.push('/kitchen')}
                className="min-h-11 justify-center"
              >
                <Text className="text-[12.5px]" tone="primary">
                  See all
                </Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-3 px-5 pb-[26px]"
            >
              {inboxItems.map((recipe) => {
                const status = inboxStatus[recipe.id];
                const badge =
                  status === 'needs_review' ? 'NEEDS REVIEW' : 'READY TO COOK';
                return (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    width={168}
                    photoHeight={132}
                    badge={badge}
                  />
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <SectionLabel className="px-5 pb-3">TONIGHT</SectionLabel>
        <View className="flex-row gap-2 px-5 pb-3.5">
          <Chip
            label="Under 30"
            selected={mood === 'quick'}
            onPress={() => setMood('quick')}
          />
          <Chip
            label="Comfort"
            selected={mood === 'comfort'}
            onPress={() => setMood('comfort')}
          />
          <Chip
            label="Fresh"
            selected={mood === 'fresh'}
            onPress={() => setMood('fresh')}
          />
        </View>
        {tonight.recipe ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tonight.recipe.title}
            onPress={() => router.push(`/recipe/${tonight.recipe?.id}`)}
            className="px-5 pb-[26px]"
          >
            <View className="overflow-hidden rounded-[22px]">
              <PhotoStandIn
                colors={tonight.recipe.placeholder}
                height={230}
                radius={22}
                uri={tonight.recipe.thumbnailUrl}
                label={`photo — ${tonight.recipe.title.toLowerCase()}`}
              />
              <View className="absolute inset-0 justify-end bg-black/40 px-[18px] pb-[18px]">
                <Text
                  className="pb-2 text-[10.5px] tracking-[0.14em]"
                  tone="accent"
                  style={{ fontFamily: fonts.mono500 }}
                >
                  {tonight.why}
                </Text>
                <Text
                  tone="inverse"
                  className="max-w-[250px] text-[25px] leading-[1.1]"
                  style={{ fontFamily: fonts.manrope800 }}
                >
                  {tonight.recipe.title}
                </Text>
                <View className="flex-row items-center gap-1.5 pt-2.5">
                  <SourceIcon source={tonight.recipe.sourceLabel} size={14} />
                  <Text
                    tone="inverse"
                    className="text-[13px]"
                    style={{ opacity: 0.74 }}
                  >
                    {tonight.recipe.minutes} min · serves{' '}
                    {tonight.recipe.servings} · from{' '}
                    {tonight.recipe.sourceLabel}
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>
        ) : null}

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
      </ScrollView>
    </Screen>
  );
}
