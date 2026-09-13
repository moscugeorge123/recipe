import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { X } from 'lucide-react-native';

import { IconButton } from '@/components/ui/icon-button';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextInput } from '@/components/ui/text-input';
import { useCreateMealPlanEntry } from '@/features/meal-plan/hooks';
import { RecipePicker } from '@/features/meal-plan/recipe-picker';
import {
  MEAL_PLAN_NOTE_MAX_LENGTH,
  MealEntryKind,
  MealSlot,
} from '@/features/meal-plan/types';
import { mapUserError } from '@/lib/user-error';
import { useUiStore } from '@/stores/ui-store';
import { colors, fonts } from '@/theme/tokens';

type AddTab = 'recipe' | 'note';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function parseSlot(value: string | undefined): MealSlot {
  if (
    value === MealSlot.BREAKFAST ||
    value === MealSlot.LUNCH ||
    value === MealSlot.DINNER ||
    value === MealSlot.SNACK
  ) {
    return value;
  }
  return MealSlot.DINNER;
}

export function AddMealScreen() {
  const params = useLocalSearchParams<{
    date?: string | string[];
    slot?: string | string[];
    recipeId?: string | string[];
  }>();
  const date = firstParam(params.date) ?? '';
  const slot = parseSlot(firstParam(params.slot));
  const incomingRecipeId = firstParam(params.recipeId) ?? null;
  const [tab, setTab] = useState<AddTab>('recipe');
  const [note, setNote] = useState('');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(
    incomingRecipeId,
  );
  const createEntry = useCreateMealPlanEntry();
  const showToast = useUiStore((state) => state.showToast);
  const trimmedNote = note.trim();
  const canSubmit =
    tab === 'note' ? trimmedNote.length > 0 : !!selectedRecipeId;

  const doneColor = canSubmit ? colors.cta : colors.ctaDisabled;

  const title = useMemo(
    () => (tab === 'note' ? 'Add note' : 'Choose recipe'),
    [tab],
  );

  const submit = async () => {
    if (!canSubmit || createEntry.isPending || !date) {
      return;
    }
    try {
      if (tab === 'note') {
        await createEntry.mutateAsync({
          date,
          slot,
          kind: MealEntryKind.NOTE,
          note: trimmedNote.slice(0, MEAL_PLAN_NOTE_MAX_LENGTH),
        });
      } else if (selectedRecipeId) {
        await createEntry.mutateAsync({
          date,
          slot,
          kind: MealEntryKind.RECIPE,
          recipeId: selectedRecipeId,
        });
      }
      router.back();
    } catch (error) {
      showToast({
        text: mapUserError(error, 'mealPlan').message,
        glyph: '!',
      });
    }
  };

  return (
    <Screen>
      <View className="flex-row items-center justify-between px-5 pb-3 pt-1">
        <IconButton
          accessibilityLabel="Close"
          onPress={() => router.back()}
        >
          <X size={22} color={colors.espresso} strokeWidth={2.2} />
        </IconButton>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Done"
          accessibilityState={{ disabled: !canSubmit }}
          disabled={!canSubmit || createEntry.isPending}
          onPress={() => {
            void submit();
          }}
          className="h-11 min-w-11 items-center justify-center px-2"
        >
          <Text
            style={{
              fontFamily: fonts.manrope700,
              color: doneColor,
            }}
          >
            Done
          </Text>
        </Pressable>
      </View>

      <View
        accessibilityRole="tablist"
        className="flex-row items-end px-5 pb-4"
      >
        {(
          [
            { id: 'recipe', label: 'Choose recipe' },
            { id: 'note', label: 'Add note' },
          ] as const
        ).map((item) => {
          const selected = tab === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setTab(item.id)}
              className="mr-6 min-h-11 justify-end"
            >
              <Text
                style={{
                  fontFamily: fonts.manrope700,
                  fontSize: 16,
                  color: selected ? colors.espresso : colors.tabInactive,
                }}
              >
                {item.label}
              </Text>
              <View
                className="mt-1.5 h-[2px] rounded-full"
                style={{
                  backgroundColor: selected ? colors.espresso : 'transparent',
                }}
              />
            </Pressable>
          );
        })}
      </View>

      <KeyboardAwareScrollView
        contentContainerClassName="px-5 pb-8"
        showsVerticalScrollIndicator={false}
      >
        {tab === 'recipe' ? (
          <RecipePicker
            selectedRecipeId={selectedRecipeId}
            onSelect={(recipeId) => setSelectedRecipeId(recipeId)}
          />
        ) : (
          <View>
            <TextInput
              value={note}
              onChangeText={(value) =>
                setNote(value.slice(0, MEAL_PLAN_NOTE_MAX_LENGTH))
              }
              maxLength={MEAL_PLAN_NOTE_MAX_LENGTH}
              placeholder="What’s cooking?"
              placeholderTextColor={colors.tabInactive}
              accessibilityLabel="Note"
              multiline
              className="min-h-[120px] rounded-[16px] px-4 py-3 text-[15px]"
              style={{
                fontFamily: fonts.manrope500,
                color: colors.espresso,
                backgroundColor: colors.searchFill,
              }}
            />
            <Text variant="caption" className="pt-2">
              {trimmedNote.length}/{MEAL_PLAN_NOTE_MAX_LENGTH}
            </Text>
          </View>
        )}
      </KeyboardAwareScrollView>
    </Screen>
  );
}
