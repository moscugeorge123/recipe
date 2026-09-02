import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { SourceIcon } from '@/components/icons/source-icon';
import { Button } from '@/components/ui/button';
import { PhotoStandIn } from '@/components/ui/photo-stand-in';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { InlineErrorPanel } from '@/components/ui/inline-error';
import { Screen } from '@/components/ui/screen';
import { Sheet } from '@/components/ui/sheet';
import { StaleIndicator } from '@/components/ui/stale-indicator';
import { Text } from '@/components/ui/text';
import { reviewToInboxStatus } from '@/features/catalog/catalog';
import { useStartCooking } from '@/features/cook-sessions/hooks';
import { isSeedRecipeId } from '@/features/kitchen/ids';
import { NutritionPanel } from '@/features/nutrition/nutrition-panel';
import { pantryKeysFrom, partitionByPantry } from '@/features/pantry/match';
import { usePantryItems } from '@/features/pantry/hooks';
import { RecipeCategoryChips } from '@/features/recipes/components/recipe-category-chips';
import { RecipeCollectionsEntry } from '@/features/recipes/components/recipe-collections-entry';
import { RecipeNotesPanel } from '@/features/recipes/components/recipe-notes';
import { RecipePantrySection } from '@/features/recipes/components/recipe-pantry-section';
import { StarRatingInput } from '@/features/recipes/components/star-rating';
import { useDeferredSecondary } from '@/features/recipes/hooks/use-deferred-secondary';
import {
  useRecipeFavorite,
  useRecipeRating,
} from '@/features/recipes/hooks/use-engagement';
import { useConfirmReviewed } from '@/features/recipes/hooks/use-review-state';
import { useRecipe } from '@/features/recipes/hooks/use-recipe';
import { planRecipe } from '@/features/recipes/plan';
import { hapticSuccess } from '@/lib/haptics';
import { mapUserError } from '@/lib/user-error';
import { usePopScale } from '@/lib/motion';
import { useKitchenStore } from '@/stores/kitchen-store';
import { useShopStore } from '@/stores/shop-store';
import { useUiStore } from '@/stores/ui-store';
import { colors, fonts } from '@/theme/tokens';

function inboxStatusFor(
  recipe: {
    id: string;
    reviewState?: 'NEEDS_REVIEW' | 'READY';
  },
  local: Record<string, 'needs_review' | 'ready' | undefined>,
  migrationComplete: boolean,
): 'needs_review' | 'ready' | undefined {
  const fromApi = reviewToInboxStatus(recipe.reviewState);
  if (fromApi) {
    return fromApi;
  }
  if (isSeedRecipeId(recipe.id) || !migrationComplete) {
    return local[recipe.id];
  }
  return undefined;
}

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const fetched = useRecipe(id);
  const recipe = fetched.data;
  const secondaryReady = useDeferredSecondary(!!recipe);
  const servingsByRecipe = useKitchenStore((state) => state.servingsByRecipe);
  const setServings = useKitchenStore((state) => state.setServings);
  const { confirm: confirmReviewed } = useConfirmReviewed();
  const pantryStaples = useKitchenStore((state) => state.pantryStaples);
  const recipeNotes = useKitchenStore((state) => state.recipeNotes);
  const localInbox = useKitchenStore((state) => state.inboxStatus);
  const migrationComplete =
    useKitchenStore((state) => state.kitchenMigration?.status) === 'completed';
  const localCooked = useKitchenStore((state) =>
    recipe ? (state.cookedCounts[recipe.id] ?? 0) : 0,
  );
  const pantryQuery = usePantryItems();
  const pantryKeys = useMemo(
    () =>
      pantryKeysFrom({
        items: pantryQuery.data?.items,
        leftoverStaples: pantryStaples,
      }),
    [pantryQuery.data?.items, pantryStaples],
  );
  const addIngredients = useShopStore((state) => state.addIngredients);
  const startCooking = useStartCooking();
  const showToast = useUiStore((state) => state.showToast);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [info, setInfo] = useState<{ title: string; body: string } | null>(
    null,
  );
  const scrollY = useRef(0);
  const heart = usePopScale();
  const favorite = useRecipeFavorite(recipe);
  const rating = useRecipeRating(recipe);
  const servings = recipe
    ? (servingsByRecipe[recipe.id] ?? recipe.servings)
    : 1;
  const servingsPop = usePopScale(servings);

  if (!recipe && fetched.isLoading) {
    return (
      <Screen className="px-5 pt-12">
        <ContentSkeleton shape="detail" />
      </Screen>
    );
  }

  if (!recipe && fetched.isError) {
    const copy = mapUserError(fetched.error ?? new Error('offline'), 'recipe');
    return (
      <Screen className="px-5 pt-12">
        <Text variant="display" className="pb-4">
          Recipe
        </Text>
        <InlineErrorPanel
          message={copy.message}
          retryLabel={copy.actionLabel}
          retrying={fetched.isFetching}
          onRetry={() => {
            void fetched.refetch();
          }}
        />
      </Screen>
    );
  }

  if (!recipe) {
    return (
      <Screen className="px-5">
        <Text variant="display">Recipe</Text>
      </Screen>
    );
  }

  const mult = servings / recipe.servings;
  const plan = planRecipe(recipe);
  const saved = favorite.isFavorite;
  const { have, need } = partitionByPantry(recipe.ingredients, pantryKeys);
  const status = inboxStatusFor(recipe, localInbox, migrationComplete);
  const notes = recipeNotes[recipe.id] ?? [];
  const cookCount =
    recipe.origin === 'api' ? (recipe.cookCount ?? 0) : localCooked;

  return (
    <Screen edges={['left', 'right']}>
      <ScrollView
        testID="recipe-detail-scroll"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-10"
        keyboardShouldPersistTaps="handled"
        onScroll={(event) => {
          // Keep offset across favorite/rating/note cache writes; do not remount.
          scrollY.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        {/* 1. Identity / categories */}
        <View>
          <PhotoStandIn
            colors={recipe.placeholder}
            height={268}
            radius={0}
            uri={recipe.thumbnailUrl}
            label={`photo — ${recipe.title.toLowerCase()}`}
          />
          <View className="absolute left-4 top-12 flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => router.back()}
              className="bg-white/86 h-11 w-11 items-center justify-center rounded-[14px]"
            >
              <Text className="text-[22px]">‹</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove from saved' : 'Save recipe'}
            accessibilityState={{ selected: saved }}
            onPress={() => {
              heart.pop();
              if (!saved) {
                confirmReviewed(recipe.id);
              }
              favorite.toggle();
            }}
            className="absolute right-4 top-12 items-center justify-center rounded-[14px]"
            style={{
              height: 44,
              width: 44,
              backgroundColor: saved ? colors.berry : 'rgba(255,255,255,0.86)',
            }}
          >
            <Animated.View style={heart.style}>
              <Text tone={saved ? 'inverse' : 'default'}>
                {saved ? '♥' : '♡'}
              </Text>
            </Animated.View>
          </Pressable>
        </View>

        <View className="px-5 pt-4">
          <View className="flex-row items-center gap-2 pb-2">
            <SourceIcon source={recipe.sourceLabel} size={16} />
            <Text variant="caption">
              {recipe.sourceLabel} · {recipe.creator}
            </Text>
          </View>
          <Text variant="display" accessibilityRole="header">
            {recipe.title}
          </Text>
          {fetched.fromCache ? (
            <StaleIndicator
              className="pt-1"
              message="Showing the last saved recipe. Retry if this looks old."
            />
          ) : null}
          {fetched.isError ? (
            <View className="pt-2">
              <InlineErrorPanel
                message={
                  mapUserError(
                    fetched.error ?? new Error('offline'),
                    'recipe',
                    {
                      log: !!fetched.error,
                    },
                  ).message
                }
                retryLabel="Retry recipe"
                retrying={fetched.isFetching}
                onRetry={() => {
                  void fetched.refetch();
                }}
              />
            </View>
          ) : null}
          <Text variant="caption" className="pt-1">
            {cookCount > 0 ? `${cookCount}× cooked` : 'Not cooked yet'}
          </Text>
          <RecipeCategoryChips recipe={recipe} editable />

          {status ? (
            <View
              className="mt-4 rounded-[16px] p-4"
              style={{ backgroundColor: colors.honey50 }}
            >
              <Text variant="kicker" style={{ color: colors.honey800 }}>
                {status === 'needs_review' ? 'NEEDS REVIEW' : 'READY TO COOK'}
              </Text>
              <Text variant="caption" className="pt-2">
                {status === 'needs_review'
                  ? 'Servings and cook time were inferred — check before cooking.'
                  : 'Imported and ready. Give it a quick look before you cook.'}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  confirmReviewed(recipe.id);
                  showToast({
                    text: 'Marked reviewed — moved to Saved',
                    glyph: '✓',
                  });
                }}
                className="mt-3 min-h-11 justify-center"
              >
                <Text tone="primary">Looks good</Text>
              </Pressable>
            </View>
          ) : null}

          {/* 2. Start cooking — only paprika primary */}
          <Button
            label="Start cooking"
            size="lg"
            className="mt-5 min-h-[58px]"
            onPress={() => {
              if (status) {
                confirmReviewed(recipe.id);
              }
              startCooking(recipe.id).catch(() => undefined);
              router.push(`/cook/${recipe.id}`);
            }}
          />

          {/* 3. Plan / servings */}
          <View className="mt-5 flex-row flex-wrap items-center gap-2 rounded-[16px] bg-linen p-3">
            {plan.stages.map((stage, index) => (
              <View key={stage.name} className="flex-row items-center gap-2">
                <View className="rounded-full bg-bg px-3 py-1.5">
                  <Text className="text-[12px]">
                    <Text
                      className="text-[12px]"
                      style={{ color: colors.honey800 }}
                    >
                      {stage.name}
                    </Text>
                    {` · ${stage.mins}m`}
                  </Text>
                </View>
                {index < plan.stages.length - 1 ? (
                  <Text tone="disabled">→</Text>
                ) : null}
              </View>
            ))}
          </View>

          <View className="mt-6 flex-row items-center justify-between">
            <Text variant="section">SERVINGS</Text>
            <View className="flex-row items-center gap-3">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Decrease servings"
                onPress={() => setServings(recipe.id, servings - 1)}
                className="h-11 w-11 items-center justify-center rounded-[14px] bg-peach"
              >
                <Text className="text-[18px]">−</Text>
              </Pressable>
              <Animated.View style={servingsPop.style}>
                <Text
                  className="min-w-[34px] text-center text-[17px]"
                  style={{ fontFamily: fonts.manrope700 }}
                >
                  {servings}
                </Text>
              </Animated.View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Increase servings"
                onPress={() => setServings(recipe.id, servings + 1)}
                className="h-11 w-11 items-center justify-center rounded-[14px] bg-peach"
              >
                <Text className="text-[18px]">+</Text>
              </Pressable>
            </View>
          </View>
          <Text variant="caption" className="pt-2">
            {servings === recipe.servings
              ? 'Detected from the source · tap to change'
              : `Scaled from ${recipe.servings} · quantities updated`}
          </Text>

          {/* 4. Pantry-aware ingredients */}
          <RecipePantrySection
            have={have}
            need={need}
            servings={servings}
            multiplier={mult}
            recipeTitle={recipe.title}
            checked={checked}
            onToggle={(ingredientId) =>
              setChecked((curr) => ({
                ...curr,
                [ingredientId]: !curr[ingredientId],
              }))
            }
            onInfo={(title, body) => setInfo({ title, body })}
            onAddAll={() => {
              addIngredients(need, recipe.title);
              hapticSuccess().catch(() => undefined);
              showToast({
                text: `${need.length} ingredients added`,
                glyph: '↓',
                action: 'View',
                onAction: () => router.push('/shop'),
              });
            }}
            onAddOne={(ing) => {
              addIngredients([ing], recipe.title);
              showToast({
                text: `${ing.name} added to Shopping`,
                glyph: '↓',
              });
            }}
          />

          {/* 5. Nutrition — section retry, never hides the recipe */}
          <NutritionPanel recipeId={recipe.id} />

          {/* 6. Rating / notes */}
          <View className="mt-6">
            <Text variant="section">YOUR RATING</Text>
            <StarRatingInput
              rating={rating.rating}
              onChange={rating.setRating}
              disabled={rating.isPending}
            />
          </View>

          {recipe.origin === 'api' ? (
            <RecipeNotesPanel recipeId={recipe.id} enabled={secondaryReady} />
          ) : notes.length ? (
            <View className="mt-6">
              <Text variant="section">NOTES</Text>
              {notes.map((item) => (
                <View
                  key={`${item.cookedAt}-${item.text}`}
                  className="mt-2 rounded-[16px] bg-linen p-4"
                >
                  <Text variant="caption">
                    {new Date(item.cookedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                  <Text className="pt-1.5">{item.text}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* 7. Collections / history / source / editing */}
          <RecipeCollectionsEntry recipeId={recipe.id} />

          {[
            { label: 'Original source', hint: recipe.sourceLabel },
            {
              label: 'Edit the extraction',
              hint: `${recipe.ingredients.length} fields`,
              route: `/recipe/${recipe.id}/edit`,
            },
            {
              label: 'Revision history',
              hint: `Revision ${recipe.revisionNumber ?? 0}`,
              route: `/recipe/${recipe.id}/history`,
            },
          ].map((row) => (
            <Pressable
              key={row.label}
              accessibilityRole="button"
              accessibilityLabel={row.label}
              onPress={() =>
                row.route
                  ? router.push(row.route as never)
                  : showToast({
                      text: `${row.label} coming soon`,
                      glyph: '›',
                    })
              }
              className="min-h-11 flex-row items-center justify-between border-b border-crust py-3"
            >
              <Text tone="icon">{row.label}</Text>
              <Text variant="caption">{row.hint}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <Sheet
        visible={!!info}
        onClose={() => setInfo(null)}
        accessibilityLabel="Ingredient"
      >
        <Text variant="kicker">INGREDIENT</Text>
        <Text variant="title" className="py-2">
          {info?.title}
        </Text>
        <Text variant="caption">{info?.body}</Text>
        <Button
          label="Got it"
          variant="inverse"
          className="mt-5"
          onPress={() => setInfo(null)}
        />
      </Sheet>
    </Screen>
  );
}
