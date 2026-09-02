import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
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
import {
  useFinishCooking,
  useStartCooking,
} from '@/features/cook-sessions/hooks';
import { createRecipeNote } from '@/features/recipes/api';
import { writeNoteDraft } from '@/features/recipes/note-drafts';
import { useRecipe } from '@/features/recipes/hooks/use-recipe';
import { isSeedRecipeId } from '@/features/kitchen/ids';
import { duration, reanimatedEasing, useReducedMotion } from '@/lib/motion';
import { useCookStore } from '@/stores/cook-store';
import { useKitchenStore } from '@/stores/kitchen-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import { CookShell, useCookTheme } from '@/theme/cook-shell';
import { colors, fonts } from '@/theme/tokens';

const recordedCookedKeys = new Set<string>();

function cookedSessionKey(recipeId: string, startedAt: number | null): string {
  return `${recipeId}:${startedAt ?? 'none'}`;
}

type KeyboardInset = {
  height: number;
  screenY: number;
  durationMs: number;
};

function useKeyboardBottomInset(): KeyboardInset {
  const [inset, setInset] = useState<KeyboardInset>({
    height: 0,
    screenY: Dimensions.get('window').height,
    durationMs: duration.sheet,
  });

  useEffect(() => {
    if (Platform.OS === 'web') {
      const viewport =
        typeof window !== 'undefined' ? window.visualViewport : null;
      const syncViewport = () => {
        if (!viewport) {
          return;
        }
        const covered = Math.max(
          0,
          window.innerHeight - viewport.height - viewport.offsetTop,
        );
        const height = covered < 100 ? 0 : covered;
        setInset({
          height,
          screenY: height > 0 ? viewport.offsetTop + viewport.height : window.innerHeight,
          durationMs: duration.sheet,
        });
      };
      viewport?.addEventListener('resize', syncViewport);
      viewport?.addEventListener('scroll', syncViewport);
      return () => {
        viewport?.removeEventListener('resize', syncViewport);
        viewport?.removeEventListener('scroll', syncViewport);
      };
    }

    const eventDuration = (ms: number | undefined) =>
      ms && ms > 0 ? ms : duration.sheet;
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => {
      setInset({
        height: event.endCoordinates.height,
        screenY: event.endCoordinates.screenY,
        durationMs: eventDuration(event.duration),
      });
    });
    const hide = Keyboard.addListener(hideEvent, (event) => {
      setInset({
        height: 0,
        screenY: Dimensions.get('window').height,
        durationMs: eventDuration(event.duration),
      });
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return inset;
}

function CompleteInner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const catalog = useCatalog();
  const fetched = useRecipe(id);
  const recipe = fetched.data ?? catalog.get(id ?? '');
  const { dark, tokens } = useCookTheme();
  const reduced = useReducedMotion();
  const [startedAt] = useState(() => useCookStore.getState().startedAt);
  const { markCompleted, clearLocal } = useFinishCooking();
  const startCooking = useStartCooking();
  const incrementCooked = useKitchenStore((state) => state.incrementCooked);
  const cookedCounts = useKitchenStore((state) => state.cookedCounts);
  const addRecipeNote = useKitchenStore((state) => state.addRecipeNote);
  const [note, setNote] = useState('');
  const [finishedAt] = useState(() => Date.now());
  const keyboard = useKeyboardBottomInset();
  const notesRef = useRef<View>(null);
  const shift = useSharedValue(0);

  useEffect(() => {
    markCompleted().catch(() => undefined);
  }, [markCompleted]);

  useEffect(() => {
    if (!recipe) {
      return;
    }
    const key = cookedSessionKey(recipe.id, startedAt);
    if (recordedCookedKeys.has(key)) {
      return;
    }
    recordedCookedKeys.add(key);
    if (isSeedRecipeId(recipe.id)) {
      incrementCooked(recipe.id);
    }
  }, [incrementCooked, recipe, startedAt]);

  const ring = useSharedValue(0.72);
  const flash = useSharedValue(reduced ? 0 : 0.55);

  useEffect(() => {
    const ms = reduced ? 0 : keyboard.durationMs;
    if (keyboard.height <= 0) {
      shift.value = withTiming(0, { duration: ms, easing: reanimatedEasing });
      return;
    }
    const handle = requestAnimationFrame(() => {
      if (shift.value > 0) {
        return;
      }
      notesRef.current?.measureInWindow((_x, y, _w, h) => {
        const overlap = y + h + 60 - keyboard.screenY;
        shift.value = withTiming(Math.max(0, overlap), {
          duration: ms,
          easing: reanimatedEasing,
        });
      });
    });
    return () => cancelAnimationFrame(handle);
  }, [keyboard.durationMs, keyboard.height, keyboard.screenY, reduced, shift]);

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
  const slideStyle = useAnimatedStyle(() => ({
    flex: 1,
    transform: [{ translateY: -shift.value }],
  }));

  if (!recipe) {
    return <Text style={{ color: tokens.text }}>Loading</Text>;
  }

  const mins = Math.max(
    1,
    Math.round((finishedAt - (startedAt ?? finishedAt)) / 60000) ||
      recipe.minutes,
  );
  const pendingCooked = !recordedCookedKeys.has(
    cookedSessionKey(recipe.id, startedAt),
  );
  const times = (cookedCounts[recipe.id] ?? 0) + (pendingCooked ? 1 : 0);

  const persistNote = () => {
    const trimmed = note.trim();
    if (!trimmed) {
      return;
    }
    if (recipe.origin === 'api') {
      const sessionId = useCookStore.getState().sessionId;
      createRecipeNote(recipe.id, {
        body: trimmed,
        ...(sessionId ? { cookSessionId: sessionId } : {}),
      }).catch(() => {
        void writeNoteDraft(recipe.id, trimmed);
      });
      return;
    }
    addRecipeNote(recipe.id, trimmed);
  };

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
      <Animated.View style={slideStyle}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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
          <View ref={notesRef} collapsable={false}>
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
              multiline
              textAlignVertical="top"
              className="min-h-[88px] rounded-[16px] p-[15px]"
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
            label="Done"
            size="lg"
            className="h-[58px]"
            onPress={() => {
              persistNote();
              clearLocal();
              router.replace('/');
            }}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              persistNote();
              startCooking(recipe.id, { reset: true }).catch(() => undefined);
              router.replace(`/cook/${recipe.id}`);
            }}
            className="h-[52px] min-h-11 items-center justify-center rounded-[16px]"
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
        </ScrollView>
      </Animated.View>
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
