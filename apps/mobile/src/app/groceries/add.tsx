import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { X } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextInput } from '@/components/ui/text-input';
import { organizePantry } from '@/features/pantry/api';
import { isGroceryCategory } from '@/features/shopping-list/aisle';
import {
  useAddShoppingItems,
  useDeleteShoppingItem,
} from '@/features/shopping-list/hooks';
import type { ShoppingListItemView } from '@/features/shopping-list/types';
import { mapUserError } from '@/lib/user-error';
import { useUiStore } from '@/stores/ui-store';
import { colors, fonts } from '@/theme/tokens';

async function organizeThenAdd(
  text: string,
  addItems: ReturnType<typeof useAddShoppingItems>['mutateAsync'],
): Promise<ShoppingListItemView[]> {
  const result = await organizePantry({ text });
  const items = [
    ...result.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      ...(isGroceryCategory(item.category) ? { category: item.category } : {}),
      emoji: item.emoji,
    })),
    ...result.unresolved.map((line) => ({ name: line.rawText })),
  ];
  if (!items.length) {
    return [];
  }
  return addItems(items);
}

export default function AddGroceriesScreen() {
  const [text, setText] = useState('');
  const [chips, setChips] = useState<ShoppingListItemView[]>([]);
  const [busy, setBusy] = useState(false);
  const addItems = useAddShoppingItems();
  const removeItem = useDeleteShoppingItem();
  const showToast = useUiStore((state) => state.showToast);
  const trimmed = text.trim();

  const commitText = async (): Promise<boolean> => {
    if (!trimmed) {
      return true;
    }
    try {
      const created = await organizeThenAdd(trimmed, addItems.mutateAsync);
      setChips((current) => [...current, ...created]);
      setText('');
      return true;
    } catch (error) {
      showToast({
        text: mapUserError(error, 'shopping').message,
        glyph: '!',
      });
      return false;
    }
  };

  const onAddChip = async () => {
    if (!trimmed || busy) {
      return;
    }
    setBusy(true);
    await commitText();
    setBusy(false);
  };

  const onDone = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    const ok = await commitText();
    setBusy(false);
    if (ok) {
      router.back();
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
          Add items
        </Text>
        <View className="h-11 w-11" />
      </View>
      <KeyboardAwareScrollView
        contentContainerClassName="px-5 pb-8"
        showsVerticalScrollIndicator={false}
      >
        {chips.length ? (
          <View className="flex-row flex-wrap gap-2 pb-4">
            {chips.map((chip) => (
              <View
                key={chip.id}
                className="bg-paper min-h-11 flex-row items-center gap-2 rounded-[13px] px-3 py-2"
              >
                <Text className="text-[16px]">{chip.emoji ?? '🛒'}</Text>
                <Text style={{ fontFamily: fonts.manrope600 }}>
                  {chip.name}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${chip.name}`}
                  onPress={() => {
                    setChips((current) =>
                      current.filter((item) => item.id !== chip.id),
                    );
                    removeItem.mutate(chip.id);
                  }}
                  className="h-11 w-8 items-center justify-center"
                >
                  <X size={16} color={colors.olive} strokeWidth={2.2} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        <View className="flex-row items-start gap-2">
          <TextInput
            accessibilityLabel="Type or paste"
            multiline
            value={text}
            onChangeText={setText}
            placeholder="Type or paste"
            placeholderTextColor={colors.olive}
            className="min-h-[56px] flex-1 rounded-[16px] border border-crust bg-peach px-4 py-3 text-[15.5px]"
            style={{
              fontFamily: fonts.manrope600,
              color: colors.espresso,
              textAlignVertical: 'top',
            }}
          />
          {trimmed ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add"
              disabled={busy}
              onPress={() => {
                void onAddChip();
              }}
              className="h-11 justify-center px-2"
            >
              <Text tone="primary" style={{ fontFamily: fonts.manrope700 }}>
                {busy ? 'Adding…' : 'Add'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAwareScrollView>
      <View className="px-5 pb-6 pt-2">
        <Button
          label={busy ? 'Saving…' : 'Done'}
          size="lg"
          disabled={busy}
          onPress={() => {
            void onDone();
          }}
        />
      </View>
    </Screen>
  );
}
