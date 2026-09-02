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
import { useSyncCookStep } from '@/features/cook-sessions/hooks';
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
  const timer = useCookStore((state) => state.timer);
  const startTimer = useCookStore((state) => state.startTimer);
  const toggleTimer = useCookStore((state) => state.toggleTimer);
  const clearTimer = useCookStore((state) => state.clearTimer);
  const servings = useKitchenStore(
    (state) => state.servingsByRecipe[id ?? ''] ?? recipe?.servings ?? 1,
  );
  const [ingOpen, setIngOpen] = useState(false);
  useKeepAwake();
  useSyncCookStep();

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
  const stepTimer = timer && timer.stepIndex === si ? timer : null;
  const timerMain = current.durationSeconds
    ? !stepTimer
      ? {
          label: `Start ${formatTimer(current.durationSeconds)} timer`,
          action: 'start' as const,
        }
      : stepTimer.running
        ? {
            label: formatTimer(stepTimer.remainingSec),
            action: null,
          }
        : stepTimer.remainingSec === 0
          ? { label: 'Done ✓', action: null }
          : { label: 'Resume', action: 'resume' as const }
    : null;
  const timerSide = stepTimer
    ? stepTimer.running
      ? { label: 'Stop', action: 'stop' as const }
      : { label: 'Reset', action: 'reset' as const }
    : null;
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
              router.replace('/');
            }}
            className="h-11 justify-center"
          >
            <Text style={{ color: tokens.muted }}>Exit</Text>
          </Pressable>
          <Text
            accessibilityLiveRegion="polite"
            style={{
              fontFamily: fonts.medium,
              color: tokens.muted,
              letterSpacing: 1.4,
            }}
          >
            STEP {si + 1} OF {steps.length}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ingredients"
            onPress={() => setIngOpen(true)}
            className="h-11 justify-center"
          >
            <Text style={{ color: tokens.muted }}>Ingredients</Text>
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
                    fontFamily: active ? fonts.bold : fonts.medium,
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
              fontFamily: fonts.bold,
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
              fontFamily: fonts.semibold,
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
                        fontFamily: fonts.semibold,
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
          {timerMain ? (
            <View className="mt-[26px] flex-row gap-2.5">
              {timerMain.action ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={timerMain.label}
                  onPress={() => {
                    if (timerMain.action === 'start') {
                      startTimer(
                        si,
                        current.durationSeconds ?? 0,
                        `Step ${si + 1}`,
                      );
                      return;
                    }
                    toggleTimer();
                  }}
                  className="h-12 min-h-12 flex-1 items-center justify-center rounded-cta px-6"
                  style={{
                    backgroundColor: stepTimer
                      ? tokens.timerOnBg
                      : tokens.timerOffBg,
                    borderWidth: 1,
                    borderColor: stepTimer
                      ? tokens.timerOnBorder
                      : tokens.timerOffBorder,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.semibold,
                      fontSize: 16,
                      color: stepTimer ? tokens.timerOnText : tokens.text,
                    }}
                  >
                    {timerMain.label}
                  </Text>
                </Pressable>
              ) : (
                <View
                  accessibilityLiveRegion="polite"
                  accessibilityLabel={timerMain.label}
                  className="h-12 min-h-12 flex-1 items-center justify-center rounded-cta px-6"
                  style={{
                    backgroundColor: tokens.timerOnBg,
                    borderWidth: 1,
                    borderColor: tokens.timerOnBorder,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.semibold,
                      fontSize: 16,
                      color: tokens.timerOnText,
                    }}
                  >
                    {timerMain.label}
                  </Text>
                </View>
              )}
              {timerSide ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={timerSide.label}
                  onPress={() => {
                    if (timerSide.action === 'stop') {
                      toggleTimer();
                      return;
                    }
                    clearTimer();
                  }}
                  className="h-12 min-h-12 min-w-[88px] items-center justify-center rounded-cta px-5"
                  style={{ backgroundColor: tokens.ghostBg }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.semibold,
                      fontSize: 16,
                      color: tokens.ghostText,
                    }}
                  >
                    {timerSide.label}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {parallel ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`While that's cooking: ${parallel.instruction}`}
              className="mt-3 rounded-card p-4"
              style={{
                backgroundColor: tokens.parallelBg,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: tokens.parallelBorder,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.bold,
                  fontSize: 10.5,
                  letterSpacing: 1,
                  color: tokens.kicker,
                  paddingBottom: 6,
                }}
              >
                {`WHILE THAT'S COOKING`}
              </Text>
              <Text
                style={{ fontFamily: fonts.medium, color: tokens.text }}
              >
                {parallel.instruction}
              </Text>
            </Pressable>
          ) : null}
        </Animated.View>
        <View className="px-5">
          <View className="flex-row items-center gap-2.5">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous step"
              disabled={si === 0}
              onPress={goPrev}
              className="h-12 w-12 items-center justify-center rounded-cta"
              style={{
                backgroundColor: tokens.ghostBg,
                opacity: si === 0 ? 0.4 : 1,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 28,
                  color: tokens.ghostText,
                  lineHeight: 32,
                }}
              >
                {'<'}
              </Text>
            </Pressable>
            <Button
              label={
                si === steps.length - 1 ? 'Finish cooking' : 'Done · next step'
              }
              size="lg"
              className="flex-1"
              onPress={goNext}
            />
          </View>
          <Text
            className="pt-2.5 text-center"
            style={{
              fontFamily: fonts.medium,
              color: tokens.muted,
              fontSize: 11,
            }}
          >
            swipe left · next
          </Text>
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
