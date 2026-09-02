import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import type { IngredientCategory } from '@/features/recipes/types';
import {
    duration,
    reanimatedEasing,
    usePopScale,
    useReducedMotion,
} from '@/lib/motion';
import { useShopStore } from '@/stores/shop-store';
import { useUiStore } from '@/stores/ui-store';
import { colors, fonts } from '@/theme/tokens';

const CATS: IngredientCategory[] = [
  'Produce',
  'Meat',
  'Dairy',
  'Pantry',
  'Spices',
  'Frozen',
];

function ShopItemRow({
  item,
  shoppingMode,
  onToggle,
}: {
  item: {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    fromRecipeCount: number;
    done: boolean;
  };
  shoppingMode: boolean;
  onToggle: () => void;
}) {
  const { pop, style } = usePopScale();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.done }}
      onPress={() => {
        pop();
        onToggle();
      }}
      className="min-h-11 flex-row items-center gap-[13px] border-b border-crust"
      style={{
        paddingVertical: shoppingMode ? 16 : 12,
        opacity: item.done ? 0.42 : 1,
      }}
    >
      <Animated.View
        className="items-center justify-center rounded-[9px]"
        style={[
          style,
          {
            width: shoppingMode ? 30 : 26,
            height: shoppingMode ? 30 : 26,
            backgroundColor: item.done ? colors.espresso : colors.butter,
            borderWidth: item.done ? 0 : 1.5,
            borderColor: colors.crust,
          },
        ]}
      >
        {item.done ? (
          <Text className="text-[13px]" tone="inverse">
            ✓
          </Text>
        ) : null}
      </Animated.View>
      <Text
        style={{
          minWidth: shoppingMode ? 78 : 66,
          fontFamily: fonts.semibold,
          fontSize: shoppingMode ? 18 : 15.5,
          color: colors.espresso,
        }}
      >
        {item.unit ? `${item.quantity} ${item.unit}` : item.quantity}
      </Text>
      <View className="flex-1">
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: shoppingMode ? 17 : 15,
            color: colors.cocoa,
            textDecorationLine: item.done ? 'line-through' : 'none',
          }}
        >
          {item.name}
        </Text>
        {item.fromRecipeCount > 1 ? (
          <Text variant="caption" className="pt-1 text-[11.5px]">
            from {item.fromRecipeCount} recipes
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function ShopScreen() {
  const items = useShopStore((state) => state.items);
  const shoppingMode = useShopStore((state) => state.shoppingMode);
  const toggleDone = useShopStore((state) => state.toggleDone);
  const toggleShoppingMode = useShopStore((state) => state.toggleShoppingMode);
  const clearDone = useShopStore((state) => state.clearDone);
  const showToast = useUiStore((state) => state.showToast);
  const left = items.filter((item) => !item.done).length;
  const pct = Math.round(
    ((items.length - left) / Math.max(items.length, 1)) * 100,
  );
  const reduced = useReducedMotion();
  const progress = useSharedValue(pct);

  useEffect(() => {
    progress.value = withTiming(pct, {
      duration: reduced ? 0 : duration.sheet,
      easing: reanimatedEasing,
    });
  }, [pct, progress, reduced]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
  }));
  const groups = CATS.map((name) => ({
    name,
    items: items.filter((item) => item.category === name),
  })).filter((group) => group.items.length);

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="pb-10"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          className="h-11 justify-center px-5"
        >
          <Text className="text-[13.5px]" tone="muted">
            ‹ My kitchen
          </Text>
        </Pressable>
        <View className="flex-row items-start justify-between px-5">
          <View>
            <Text variant="display" accessibilityRole="header">
              Shopping
            </Text>
            <Text variant="caption" className="pt-2">
              {left ? `${left} left · merged from recipes` : 'All done'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={toggleShoppingMode}
            className="h-11 justify-center rounded-[13px] px-4"
            style={{
              backgroundColor: shoppingMode ? colors.espresso : colors.peach,
            }}
          >
            <Text
              style={{
                fontFamily: fonts.semibold,
                fontSize: 13,
                color: shoppingMode ? colors.cream : colors.cocoa,
              }}
            >
              {shoppingMode ? 'Done' : 'Shopping mode'}
            </Text>
          </Pressable>
        </View>
        <View className="px-5 py-4">
          <View className="h-1.5 overflow-hidden rounded-full bg-crust">
            <Animated.View
              className="h-full rounded-full bg-secondary"
              style={progressStyle}
            />
          </View>
        </View>
        {groups.map((group) => (
          <View key={group.name} className="px-5 pt-4">
            <Text
              variant="mono"
              className="pb-1 text-[11.5px] tracking-[0.14em]"
            >
              {group.name.toUpperCase()}
            </Text>
            {group.items.map((item) => (
              <ShopItemRow
                key={item.id}
                item={item}
                shoppingMode={shoppingMode}
                onToggle={() => toggleDone(item.id)}
              />
            ))}
          </View>
        ))}
        {!left ? (
          <View className="mx-5 mt-6 items-center rounded-[20px] bg-secondary-soft p-5">
            <Text
              className="text-center text-[19px]"
              style={{ fontFamily: fonts.semibold, color: colors.espresso }}
            >
              Basket done — {items.length} items.
            </Text>
            <Text
              className="py-2 text-center text-[13.5px]"
              style={{ color: colors.basil700 }}
            >
              Everything for your recipes is in.
            </Text>
            <Button
              label="Clear the list"
              variant="secondary"
              onPress={() => {
                clearDone();
                showToast({ text: 'List cleared', glyph: '✓' });
              }}
            />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
