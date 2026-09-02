import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useCatalog } from '@/features/catalog/use-catalog';
import { useStartCooking } from '@/features/cook-sessions/hooks';
import { useRecipe } from '@/features/recipes/hooks/use-recipe';
import { planRecipe } from '@/features/recipes/plan';
import { useCookStore } from '@/stores/cook-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import { CookShell } from '@/theme/cook-shell';
import { getCookTokens } from '@/theme/cook-tokens';
import { fonts } from '@/theme/tokens';

export default function CookIntroScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = usePreferencesStore((state) => state.cookingTheme);
  const catalog = useCatalog();
  const fetched = useRecipe(id);
  const recipe = fetched.data ?? catalog.get(id ?? '');
  const startCooking = useStartCooking();

  useFocusEffect(
    useCallback(() => {
      if (!recipe) {
        return;
      }
      if (useCookStore.getState().terminalStatus) {
        return;
      }
      startCooking(recipe.id).catch(() => undefined);
    }, [recipe, startCooking]),
  );

  if (!recipe) {
    return (
      <CookShell theme={theme}>
        <Text style={{ color: getCookTokens(theme).text }}>Loading</Text>
      </CookShell>
    );
  }

  const plan = planRecipe(recipe);

  return (
    <CookShell theme={theme}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 22,
          paddingTop: 54,
          paddingBottom: 30,
          flexGrow: 1,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Exit cooking"
          onPress={() => router.back()}
          className="h-11 justify-center"
        >
          <Text style={{ color: getCookTokens(theme).muted }}>Exit</Text>
        </Pressable>
        <Text
          style={{
            fontFamily: fonts.semibold,
            letterSpacing: 0,
            color: getCookTokens(theme).kicker,
            paddingTop: 12,
          }}
        >
          READY IN {recipe.minutes} MIN
        </Text>
        <Text
          style={{
            fontFamily: fonts.medium,
            fontSize: 32,
            lineHeight: 32 * 1.19,
            letterSpacing: -0.32,
            color: getCookTokens(theme).text,
            paddingTop: 12,
          }}
        >
          The Plan
        </Text>
        <View className="mt-6 gap-4">
          {plan.stages.map((stage) => (
            <View key={stage.name}>
              <Text
                style={{
                  fontFamily: fonts.semibold,
                  letterSpacing: 0,
                  color: getCookTokens(theme).kicker,
                }}
              >
                {stage.name} · {stage.mins} MIN
              </Text>
              {stage.rows.map((row) => (
                <Text
                  key={row.label}
                  style={{
                    color: getCookTokens(theme).rowText,
                    paddingTop: 8,
                    fontSize: 16,
                    fontFamily: fonts.regular,
                  }}
                >
                  {row.label}
                </Text>
              ))}
            </View>
          ))}
        </View>
        <View className="mt-auto pt-8">
          <Button
            label="I'm ready — step 1"
            size="lg"
            onPress={() => router.push(`/cook/${recipe.id}/step`)}
          />
        </View>
      </ScrollView>
    </CookShell>
  );
}
