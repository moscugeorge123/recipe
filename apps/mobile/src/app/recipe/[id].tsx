import { router, useLocalSearchParams, type Href } from 'expo-router';
import {
  Bookmark,
  ChevronLeft,
  Ellipsis,
  Share2,
} from 'lucide-react-native';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, Share, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GroceriesBasketIcon,
  MealPlanCalendarIcon,
} from '@/components/icons/recime-tab-icons';
import { Button } from '@/components/ui/button';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { IconButton } from '@/components/ui/icon-button';
import { InlineErrorPanel } from '@/components/ui/inline-error';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { PhotoStandIn } from '@/components/ui/photo-stand-in';
import { Screen } from '@/components/ui/screen';
import { Sheet } from '@/components/ui/sheet';
import { StaleIndicator } from '@/components/ui/stale-indicator';
import { Text } from '@/components/ui/text';
import { reviewToInboxStatus } from '@/features/catalog/catalog';
import { useStartCooking } from '@/features/cook-sessions/hooks';
import { isSeedRecipeId } from '@/features/kitchen/ids';
import { NutritionPanel } from '@/features/nutrition/nutrition-panel';
import { usePantryItems } from '@/features/pantry/hooks';
import { pantryKeysFrom, partitionByPantry } from '@/features/pantry/match';
import { RecipeCollectionsEntry } from '@/features/recipes/components/recipe-collections-entry';
import { RecipePantrySection } from '@/features/recipes/components/recipe-pantry-section';
import { useRecipeFavorite } from '@/features/recipes/hooks/use-engagement';
import { useRecipe } from '@/features/recipes/hooks/use-recipe';
import { useConfirmReviewed } from '@/features/recipes/hooks/use-review-state';
import type { RecipeView } from '@/features/recipes/types';
import { useAddFromRecipe } from '@/features/shopping-list/hooks';
import { hapticSuccess } from '@/lib/haptics';
import { usePopScale } from '@/lib/motion';
import { mapUserError } from '@/lib/user-error';
import { useKitchenStore } from '@/stores/kitchen-store';
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function StepInstruction({
  instruction,
  names,
}: {
  instruction: string;
  names: string[];
}) {
  const unique = [
    ...new Set(
      names
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
        .sort((a, b) => b.length - a.length),
    ),
  ];
  if (!unique.length) {
    return <Text className="flex-1">{instruction}</Text>;
  }

  const pattern = new RegExp(
    `\\b(${unique.map(escapeRegExp).join('|')})\\b`,
    'gi',
  );
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = pattern.exec(instruction);
  let key = 0;
  while (match) {
    if (match.index > lastIndex) {
      nodes.push(instruction.slice(lastIndex, match.index));
    }
    const value = match[0];
    nodes.push(
      <Text key={`ing-${key}`} style={{ color: colors.ingredientLink }}>
        {value}
      </Text>,
    );
    key += 1;
    lastIndex = match.index + value.length;
    if (value.length === 0) {
      pattern.lastIndex += 1;
    }
    match = pattern.exec(instruction);
  }
  if (lastIndex < instruction.length) {
    nodes.push(instruction.slice(lastIndex));
  }

  return <Text className="flex-1">{nodes}</Text>;
}

function shareRecipe(recipe: RecipeView) {
  const url = recipe.originalUrl ?? '';
  void Share.share({
    title: recipe.title,
    message: url ? `${recipe.title}\n${url}` : recipe.title,
    url: url || undefined,
  }).catch(() => undefined);
}

const heroChromeFill = 'rgba(255,255,255,0.86)';

function HeroChrome({
  recipeId,
  onOverflow,
}: {
  recipeId: string;
  onOverflow: () => void;
}) {
  return (
    <View className="absolute left-4 right-4 top-12 flex-row items-center justify-between">
      <IconButton
        accessibilityLabel="Back"
        onPress={() => router.back()}
        style={{ backgroundColor: heroChromeFill }}
      >
        <ChevronLeft size={22} color={colors.espresso} strokeWidth={2.2} />
      </IconButton>
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit"
          onPress={() => router.push(`/recipe/${recipeId}/edit` as Href)}
          className="h-11 items-center justify-center rounded-full px-3.5"
          style={{ backgroundColor: heroChromeFill }}
        >
          <Text
            className="text-[14px]"
            style={{ fontFamily: fonts.manrope600 }}
          >
            Edit
          </Text>
        </Pressable>
        <IconButton
          accessibilityLabel="More"
          onPress={onOverflow}
          style={{ backgroundColor: heroChromeFill }}
        >
          <Ellipsis size={22} color={colors.espresso} strokeWidth={2} />
        </IconButton>
      </View>
    </View>
  );
}

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const fetched = useRecipe(id);
  const recipe = fetched.data;
  const insets = useSafeAreaInsets();
  const servingsByRecipe = useKitchenStore((state) => state.servingsByRecipe);
  const setServings = useKitchenStore((state) => state.setServings);
  const { confirm: confirmReviewed } = useConfirmReviewed();
  const pantryStaples = useKitchenStore((state) => state.pantryStaples);
  const localInbox = useKitchenStore((state) => state.inboxStatus);
  const migrationComplete =
    useKitchenStore((state) => state.kitchenMigration?.status) === 'completed';
  const pantryQuery = usePantryItems();
  const pantryKeys = useMemo(
    () =>
      pantryKeysFrom({
        items: pantryQuery.data?.items,
        leftoverStaples: pantryStaples,
      }),
    [pantryQuery.data?.items, pantryStaples],
  );
  const addFromRecipe = useAddFromRecipe();
  const startCooking = useStartCooking();
  const showToast = useUiStore((state) => state.showToast);
  const [overflow, setOverflow] = useState(false);
  const scrollY = useRef(0);
  const pinPop = usePopScale();
  const favorite = useRecipeFavorite(recipe);
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
  const saved = favorite.isFavorite;
  const { have, need } = partitionByPantry(recipe.ingredients, pantryKeys);
  const status = inboxStatusFor(recipe, localInbox, migrationComplete);
  const ingredientNames = recipe.ingredients.map((ing) => ing.name);

  const beginCooking = () => {
    if (status) {
      confirmReviewed(recipe.id);
    }
    startCooking(recipe.id).catch(() => undefined);
    router.push(`/cook/${recipe.id}`);
  };

  return (
    <Screen edges={['left', 'right']}>
      <KeyboardAwareScrollView
        testID="recipe-detail-scroll"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-8"
        onScroll={(event) => {
          scrollY.current = event.nativeEvent.contentOffset.y;
        }}
      >
        <View>
          <PhotoStandIn
            colors={recipe.placeholder}
            height={268}
            radius={0}
            uri={recipe.thumbnailUrl}
            label={`photo — ${recipe.title.toLowerCase()}`}
          />
          <HeroChrome
            recipeId={recipe.id}
            onOverflow={() => setOverflow(true)}
          />
        </View>

        <View className="px-5 pt-4">
          {fetched.fromCache ? (
            <StaleIndicator
              className="pb-2"
              message="Showing the last saved recipe. Retry if this looks old."
            />
          ) : null}
          {fetched.isError ? (
            <View className="pb-2">
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

          <Text variant="display" accessibilityRole="header">
            {recipe.title}
          </Text>
          <View className="pt-3">
            <RecipeCollectionsEntry recipeId={recipe.id} />
          </View>

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

          <View className="mt-5 flex-row">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Meal Plan"
              onPress={() =>
                router.push({
                  pathname: '/plan',
                  params: { addRecipeId: recipe.id },
                } as never)
              }
              className="min-h-11 flex-1 items-center justify-center gap-1 py-2"
            >
              <MealPlanCalendarIcon size={22} color={colors.espresso} />
              <Text variant="caption">Meal Plan</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Groceries"
              onPress={() => router.push('/groceries' as Href)}
              className="min-h-11 flex-1 items-center justify-center gap-1 py-2"
            >
              <GroceriesBasketIcon size={22} color={colors.espresso} />
              <Text variant="caption">Groceries</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={saved ? 'Unpin recipe' : 'Pin recipe'}
              accessibilityState={{ selected: saved }}
              onPress={() => {
                pinPop.pop();
                if (!saved) {
                  confirmReviewed(recipe.id);
                }
                favorite.toggle();
              }}
              className="items-center justify-center gap-1 py-2"
              style={{ flex: 1, minHeight: 44 }}
            >
              <Animated.View style={pinPop.style}>
                <Bookmark
                  size={22}
                  color={colors.espresso}
                  strokeWidth={1.75}
                  fill={saved ? colors.espresso : 'transparent'}
                />
              </Animated.View>
              <Text variant="caption">Pin</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share"
              onPress={() => shareRecipe(recipe)}
              className="min-h-11 flex-1 items-center justify-center gap-1 py-2"
            >
              <Share2 size={22} color={colors.espresso} strokeWidth={1.75} />
              <Text variant="caption">Share</Text>
            </Pressable>
          </View>

          <RecipePantrySection
            ingredients={recipe.ingredients}
            haveCount={have.length}
            multiplier={mult}
          />

          <Button
            label="Add to groceries"
            size="lg"
            className="mt-4"
            disabled={!need.length || addFromRecipe.isPending}
            onPress={() => {
              void addFromRecipe
                .mutateAsync({ recipeId: recipe.id, servings })
                .then((added) => {
                  hapticSuccess().catch(() => undefined);
                  showToast({
                    text: added.length
                      ? `${added.length} ingredient${added.length === 1 ? '' : 's'} added`
                      : 'Nothing to add — pantry already has these',
                    glyph: '↓',
                    action: 'View',
                    onAction: () => router.push('/groceries' as Href),
                  });
                })
                .catch((error: unknown) => {
                  showToast({
                    text: mapUserError(error, 'shopping').message,
                    glyph: '!',
                  });
                });
            }}
          />

          <View className="mt-8">
            <Text variant="section">INSTRUCTIONS</Text>
            {recipe.steps.map((step, index) => (
              <View key={step.id} className="mt-4 flex-row items-start gap-3">
                <Text
                  className="w-6 pt-0.5 text-center"
                  style={{ fontFamily: fonts.manrope700 }}
                >
                  {index + 1}
                </Text>
                <StepInstruction
                  instruction={step.instruction}
                  names={ingredientNames}
                />
              </View>
            ))}
          </View>

          <NutritionPanel recipeId={recipe.id} />
        </View>
      </KeyboardAwareScrollView>

      <View
        className="flex-row items-center gap-3 border-t border-crust px-5 pt-3"
        style={{
          backgroundColor: colors.page,
          paddingBottom: Math.max(insets.bottom, 16),
        }}
      >
        <View className="flex-row items-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decrease servings"
            hitSlop={8}
            onPress={() => setServings(recipe.id, servings - 1)}
            className="h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.peach }}
          >
            <Text className="text-[15px]" style={{ fontFamily: fonts.manrope700 }}>
              −
            </Text>
          </Pressable>
          <Animated.View style={servingsPop.style}>
            <Text
              accessibilityLabel={`${servings} servings`}
              className="min-w-[52px] px-1.5 text-center text-[14px]"
              style={{ fontFamily: fonts.manrope700 }}
            >
              {servings}
            </Text>
          </Animated.View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Increase servings"
            hitSlop={8}
            onPress={() => setServings(recipe.id, servings + 1)}
            className="h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.peach }}
          >
            <Text className="text-[15px]" style={{ fontFamily: fonts.manrope700 }}>
              +
            </Text>
          </Pressable>
        </View>
        <Button
          label="Start cooking"
          size="md"
          className="min-h-[48px] flex-1"
          onPress={beginCooking}
        />
      </View>

      <Sheet
        visible={overflow}
        onClose={() => setOverflow(false)}
        accessibilityLabel="More"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Revision history"
          onPress={() => {
            setOverflow(false);
            router.push(`/recipe/${recipe.id}/history` as Href);
          }}
          className="min-h-11 flex-row items-center justify-between border-b border-crust py-3"
        >
          <Text tone="icon">Revision history</Text>
          <Text variant="caption">Revision {recipe.revisionNumber ?? 0}</Text>
        </Pressable>
      </Sheet>
    </Screen>
  );
}
