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
import { CookShell } from '@/theme/cook-shell';
import { getCookTokens } from '@/theme/cook-tokens';
import { fonts } from '@/theme/tokens';

export default function CookIntroScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tokens = getCookTokens();
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
      <CookShell>
        <Text style={{ color: tokens.text }}>Loading</Text>
      </CookShell>
    );
  }

  const plan = planRecipe(recipe);

  return (
    <CookShell>
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
          <Text style={{ color: tokens.muted }}>Exit</Text>
        </Pressable>
        <Text
          style={{
            fontFamily: fonts.mono500,
            letterSpacing: 2,
            color: tokens.kicker,
            paddingTop: 12,
          }}
        >
          READY IN {recipe.minutes} MIN
        </Text>
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 32,
            color: tokens.text,
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
                  fontFamily: fonts.mono700,
                  letterSpacing: 1.5,
                  color: tokens.kicker,
                }}
              >
                {stage.name} · {stage.mins} MIN
              </Text>
              {stage.rows.map((row) => (
                <Text
                  key={row.label}
                  style={{
                    color: tokens.rowText,
                    paddingTop: 8,
                    fontSize: 15.5,
                    fontFamily: fonts.manrope500,
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
            className="h-[60px]"
            onPress={() => router.push(`/cook/${recipe.id}/step`)}
          />
        </View>
      </ScrollView>
    </CookShell>
  );
}
