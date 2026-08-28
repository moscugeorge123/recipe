import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useCatalog } from '@/features/catalog/use-catalog';
import { useRecipe } from '@/features/recipes/hooks/use-recipe';
import { reanimatedEasing, useReducedMotion } from '@/lib/motion';
import { useCookStore } from '@/stores/cook-store';
import { useKitchenStore } from '@/stores/kitchen-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useUiStore } from '@/stores/ui-store';
import { CookShell, useCookTheme } from '@/theme/cook-shell';
import { colors, fonts } from '@/theme/tokens';

function CompleteInner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const catalog = useCatalog();
  const fetched = useRecipe(id);
  const recipe = fetched.data ?? catalog.get(id ?? '');
  const { dark, tokens } = useCookTheme();
  const reduced = useReducedMotion();
  const startedAt = useCookStore((state) => state.startedAt);
  const exit = useCookStore((state) => state.exit);
  const start = useCookStore((state) => state.start);
  const incrementCooked = useKitchenStore((state) => state.incrementCooked);
  const cookedCounts = useKitchenStore((state) => state.cookedCounts);
  const showToast = useUiStore((state) => state.showToast);
  const [note, setNote] = useState('');
  const [finishedAt] = useState(() => Date.now());
  const ring = useSharedValue(0.72);
  const flash = useSharedValue(reduced ? 0 : 0.55);

  useEffect(() => {
    if (reduced) {
      ring.value = 1;
      flash.value = 0;
      return;
    }
    ring.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 900, easing: reanimatedEasing }),
        withTiming(0.92, { duration: 900, easing: reanimatedEasing }),
      ),
      -1,
      false,
    );
    flash.value = withTiming(0, {
      duration: 700,
      easing: Easing.out(Easing.quad),
    });
  }, [flash, reduced, ring]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ring.value }],
    opacity: 0.55,
  }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value,
  }));

  if (!recipe) {
    return <Text style={{ color: tokens.text }}>Loading</Text>;
  }

  const mins = Math.max(
    1,
    Math.round((finishedAt - (startedAt ?? finishedAt)) / 60000) ||
      recipe.minutes,
  );
  const times = (cookedCounts[recipe.id] ?? 0) + 1;

  return (
    <View className="flex-1">
      <Animated.View
        pointerEvents="none"
        style={[
          flashStyle,
          {
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: colors.paprika,
            zIndex: 2,
          },
        ]}
      />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 22,
          paddingTop: 58,
          paddingBottom: 26,
        }}
      >
        <View className="flex-1 justify-center gap-5">
          <View className="h-[86px] w-[86px] items-center justify-center">
            <Animated.View
              className="absolute h-[86px] w-[86px] rounded-full border-2"
              style={[ringStyle, { borderColor: colors.paprika }]}
            />
            <View
              className="h-[70px] w-[70px] items-center justify-center rounded-full"
              style={{
                backgroundColor: dark ? colors.paprika400 : colors.paprika,
              }}
            >
              <Text className="text-[30px]" style={{ color: colors.espresso }}>
                ✓
              </Text>
            </View>
          </View>
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 33,
              lineHeight: 36,
              color: tokens.text,
            }}
          >
            You cooked {recipe.title}.
          </Text>
          <View className="flex-row gap-2.5">
            {[
              { k: 'ON THE CLOCK', v: `${mins} min` },
              { k: 'STEPS', v: String(recipe.steps.length) },
              { k: 'TIMES COOKED', v: times === 1 ? '1st' : `${times}×` },
            ].map((stat) => (
              <View
                key={stat.k}
                className="flex-1 rounded-[16px] p-3.5"
                style={{ backgroundColor: tokens.statBg }}
              >
                <Text
                  style={{
                    fontFamily: fonts.mono500,
                    fontSize: 10,
                    color: tokens.muted,
                  }}
                >
                  {stat.k}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.manrope700,
                    fontSize: 19,
                    color: tokens.text,
                    paddingTop: 8,
                  }}
                >
                  {stat.v}
                </Text>
              </View>
            ))}
          </View>
          <View>
            <Text
              style={{
                color: tokens.muted,
                fontFamily: fonts.manrope600,
                paddingBottom: 9,
              }}
            >
              Anything to remember for next time?
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a note — less lemon, more heat…"
              placeholderTextColor={tokens.noteText}
              accessibilityLabel="Cooking note"
              className="min-h-[52px] rounded-[16px] p-[15px]"
              style={{
                backgroundColor: tokens.statBg,
                color: tokens.text,
                fontFamily: fonts.manrope500,
                fontSize: 15,
              }}
            />
          </View>
        </View>
        <View className="gap-2.5">
          <Button
            label="Save to Cooked"
            size="lg"
            className="h-[58px]"
            onPress={() => {
              incrementCooked(recipe.id);
              exit();
              showToast({
                text: `Added to Cooked · ${recipe.title}`,
                glyph: '✓',
              });
              router.replace('/');
            }}
          />
          <View className="flex-row gap-2.5">
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                showToast({ text: 'Share — prototype stub', glyph: '›' })
              }
              className="h-[52px] min-h-11 flex-1 items-center justify-center rounded-[16px]"
              style={{ backgroundColor: tokens.ghostBg }}
            >
              <Text
                style={{
                  fontFamily: fonts.manrope700,
                  color: tokens.ghostText,
                }}
              >
                Share
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                start(recipe.id);
                router.replace(`/cook/${recipe.id}`);
              }}
              className="h-[52px] min-h-11 flex-1 items-center justify-center rounded-[16px]"
              style={{ backgroundColor: tokens.ghostBg }}
            >
              <Text
                style={{
                  fontFamily: fonts.manrope700,
                  color: tokens.ghostText,
                }}
              >
                Cook again
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export default function CookCompleteScreen() {
  const theme = usePreferencesStore((state) => state.cookingTheme);
  return (
    <CookShell theme={theme}>
      <CompleteInner />
    </CookShell>
  );
}
