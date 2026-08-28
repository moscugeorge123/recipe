import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, runOnJS } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { useCatalog } from '@/features/catalog/use-catalog';
import { formatTimer, parseIngredientHint } from '@/features/cook/parse-hint';
import { useRecipe } from '@/features/recipes/hooks/use-recipe';
import { formatQty } from '@/features/recipes/plan';
import { announce } from '@/lib/announce';
import { hapticMedium } from '@/lib/haptics';
import { duration, useReducedMotion } from '@/lib/motion';
import { useCookStore } from '@/stores/cook-store';
import { useKitchenStore } from '@/stores/kitchen-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import { CookShell, useCookTheme } from '@/theme/cook-shell';
import { fonts } from '@/theme/tokens';

function CookStepInner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const catalog = useCatalog();
  const fetched = useRecipe(id);
  const recipe = fetched.data ?? catalog.get(id ?? '');
  const tokens = useCookTheme().tokens;
  const reduced = useReducedMotion();
  const stepIndex = useCookStore((state) => state.stepIndex);
  const setStep = useCookStore((state) => state.setStep);
  const exit = useCookStore((state) => state.exit);
  const timer = useCookStore((state) => state.timer);
  const startTimer = useCookStore((state) => state.startTimer);
  const servings = useKitchenStore(
    (state) => state.servingsByRecipe[id ?? ''] ?? recipe?.servings ?? 1,
  );
  const [ingOpen, setIngOpen] = useState(false);
  useKeepAwake();

  const steps = recipe?.steps ?? [];
  const si = Math.min(stepIndex, Math.max(steps.length - 1, 0));
  const current = steps[si];

  useEffect(() => {
    if (current) {
      announce(`Step ${si + 1} of ${steps.length}. ${current.instruction}`);
    }
  }, [current, si, steps.length]);

  const goNext = useCallback(() => {
    hapticMedium().catch(() => undefined);
    if (si >= steps.length - 1) {
      router.replace(`/cook/${recipe?.id}/complete`);
      return;
    }
    setStep(si + 1);
  }, [recipe?.id, setStep, si, steps.length]);

  const goPrev = useCallback(() => {
    if (si > 0) {
      setStep(si - 1);
    }
  }, [setStep, si]);

  const swipe = Gesture.Pan().onEnd((event) => {
    if (event.translationX < -50) {
      runOnJS(goNext)();
    } else if (event.translationX > 50) {
      runOnJS(goPrev)();
    }
  });

  if (!recipe || !current) {
    return <Text style={{ color: tokens.text }}>Loading</Text>;
  }

  const stages = Array.from(new Set(steps.map((step) => step.stage)));
  const ingList = parseIngredientHint(current.ingredientHint);
  const timerLabel = current.durationSeconds
    ? timer && timer.stepIndex === si
      ? timer.running
        ? `Running · ${formatTimer(timer.remainingSec)}`
        : timer.remainingSec === 0
          ? 'Done ✓'
          : `Paused · ${formatTimer(timer.remainingSec)}`
      : `Start ${formatTimer(current.durationSeconds)} timer`
    : '';
  const parallel =
    timer?.running && timer.stepIndex === si && steps[si + 1]
      ? steps[si + 1]
      : null;
  const mult = servings / recipe.servings;

  return (
    <GestureDetector gesture={swipe}>
      <View className="flex-1" style={{ paddingTop: 54, paddingBottom: 22 }}>
        <View className="flex-row items-center justify-between px-5 pb-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Exit cooking"
            onPress={() => {
              exit();
              router.replace('/');
            }}
            className="h-11 justify-center"
          >
            <Text style={{ color: tokens.muted }}>Exit</Text>
          </Pressable>
          <Text
            accessibilityLiveRegion="polite"
            style={{
              fontFamily: fonts.mono500,
              color: tokens.muted,
              letterSpacing: 1.4,
            }}
          >
            STEP {si + 1} OF {steps.length}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="All ingredients"
            onPress={() => setIngOpen(true)}
            className="h-11 justify-center"
          >
            <Text style={{ color: tokens.muted }}>All</Text>
          </Pressable>
        </View>
        <View className="flex-row gap-1.5 px-5">
          {stages.map((name) => {
            const idxs = steps
              .map((step, index) => (step.stage === name ? index : -1))
              .filter((index) => index >= 0);
            const last = idxs[idxs.length - 1] ?? -1;
            const done = last < si;
            const active = idxs.includes(si);
            return (
              <View key={name} style={{ flex: active ? 1.6 : 1, gap: 7 }}>
                <View
                  style={{
                    height: 4,
                    borderRadius: 4,
                    backgroundColor:
                      done || active ? tokens.dot : tokens.progressTrack,
                  }}
                />
                <Text
                  style={{
                    fontFamily: active ? fonts.mono700 : fonts.mono500,
                    fontSize: 9.5,
                    letterSpacing: 1.2,
                    color: active ? tokens.text : tokens.muted,
                  }}
                >
                  {name}
                </Text>
              </View>
            );
          })}
        </View>
        <Animated.View
          key={current.id}
          entering={reduced ? undefined : FadeIn.duration(duration.step)}
          className="flex-1 justify-center px-[22px] py-[26px]"
        >
          <Text
            style={{
              fontFamily: fonts.mono700,
              letterSpacing: 1.6,
              color: tokens.kicker,
              fontSize: 12,
            }}
          >
            STEP {si + 1} OF {steps.length}
          </Text>
          <Text
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
            style={{
              fontFamily: fonts.manrope700,
              fontSize: 30,
              lineHeight: 36,
              color: tokens.text,
              paddingTop: 16,
            }}
          >
            {current.instruction}
          </Text>
          {ingList.length ? (
            <View className="flex-row flex-wrap gap-2 pt-[22px]">
              {ingList.map((item) => (
                <View
                  key={`${item.qty}-${item.name}`}
                  className="flex-row items-baseline gap-2 rounded-[13px] px-3.5 py-2.5"
                  style={{ backgroundColor: tokens.chipBg }}
                >
                  {item.qty ? (
                    <Text
                      style={{
                        fontFamily: fonts.manrope700,
                        color: tokens.text,
                      }}
                    >
                      {item.qty}
                    </Text>
                  ) : null}
                  <Text style={{ color: tokens.muted }}>{item.name}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {timerLabel ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={timerLabel}
              onPress={() =>
                startTimer(si, current.durationSeconds ?? 0, `Step ${si + 1}`)
              }
              className="mt-[26px] h-14 min-h-11 items-center justify-center rounded-[17px] px-[22px]"
              style={{
                backgroundColor:
                  timer?.stepIndex === si
                    ? tokens.timerOnBg
                    : tokens.timerOffBg,
                borderWidth: 1,
                borderColor:
                  timer?.stepIndex === si
                    ? tokens.timerOnBorder
                    : tokens.timerOffBorder,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.manrope700,
                  fontSize: 16,
                  color:
                    timer?.stepIndex === si ? tokens.timerOnText : tokens.text,
                }}
              >
                {timerLabel}
              </Text>
            </Pressable>
          ) : null}
          {parallel ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`While that's cooking: ${parallel.instruction}`}
              className="mt-3 rounded-[15px] p-4"
              style={{
                backgroundColor: tokens.parallelBg,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: tokens.parallelBorder,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.mono700,
                  fontSize: 10.5,
                  letterSpacing: 1,
                  color: tokens.kicker,
                  paddingBottom: 6,
                }}
              >
                {`WHILE THAT'S COOKING`}
              </Text>
              <Text
                style={{ fontFamily: fonts.manrope600, color: tokens.text }}
              >
                {parallel.instruction}
              </Text>
            </Pressable>
          ) : null}
        </Animated.View>
        <View className="px-5">
          <Button
            label={
              si === steps.length - 1 ? 'Finish cooking' : 'Done · next step'
            }
            size="lg"
            className="h-[62px]"
            onPress={goNext}
          />
          <View className="flex-row items-center justify-between pt-2.5">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous step"
              onPress={goPrev}
              className="h-11 justify-center"
            >
              <Text style={{ color: tokens.muted }}>‹ Previous</Text>
            </Pressable>
            <Text
              style={{
                fontFamily: fonts.mono500,
                color: tokens.muted,
                fontSize: 11,
              }}
            >
              swipe left · next
            </Text>
          </View>
        </View>
        <Sheet
          visible={ingOpen}
          onClose={() => setIngOpen(false)}
          accessibilityLabel="Ingredients"
        >
          <Text variant="kicker">ALL INGREDIENTS</Text>
          <Text variant="title" className="py-2">
            For {servings} servings
          </Text>
          {recipe.ingredients.map((ing) => (
            <View
              key={ing.id}
              className="min-h-11 flex-row items-center justify-between border-b border-crust py-3"
            >
              <Text className="flex-1" tone="icon">
                {ing.name}
              </Text>
              <Text variant="caption">
                {formatQty(ing.quantity, ing.unit, mult)}
              </Text>
            </View>
          ))}
          <Button
            label="Back to cooking"
            variant="inverse"
            className="mt-5"
            onPress={() => setIngOpen(false)}
          />
        </Sheet>
      </View>
    </GestureDetector>
  );
}

export default function CookStepScreen() {
  const theme = usePreferencesStore((state) => state.cookingTheme);
  return (
    <CookShell theme={theme}>
      <CookStepInner />
    </CookShell>
  );
}
