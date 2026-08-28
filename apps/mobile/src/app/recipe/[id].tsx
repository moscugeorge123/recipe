import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { SourceIcon } from '@/components/icons/source-icon';
import { Button } from '@/components/ui/button';
import { PhotoStandIn } from '@/components/ui/photo-stand-in';
import { Screen } from '@/components/ui/screen';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { useCatalog } from '@/features/catalog/use-catalog';
import { useRecipe } from '@/features/recipes/hooks/use-recipe';
import { formatQty, planRecipe } from '@/features/recipes/plan';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { usePopScale } from '@/lib/motion';
import { isHave } from '@/stores/contracts';
import { useCookStore } from '@/stores/cook-store';
import { useKitchenStore } from '@/stores/kitchen-store';
import { useShopStore } from '@/stores/shop-store';
import { useUiStore } from '@/stores/ui-store';
import { colors, fonts } from '@/theme/tokens';

function NeedRow({
  name,
  qty,
  checked,
  onToggle,
  onInfo,
  onAdd,
}: {
  name: string;
  qty: string;
  checked: boolean;
  onToggle: () => void;
  onInfo: () => void;
  onAdd: () => void;
}) {
  const { pop, style } = usePopScale();

  return (
    <View className="min-h-11 flex-row items-center gap-3 border-b border-crust py-3">
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={name}
        onPress={() => {
          pop();
          onToggle();
        }}
        className="h-11 w-11 items-center justify-center"
      >
        <Animated.View
          className="h-[26px] w-[26px] items-center justify-center rounded-[9px] border border-crust"
          style={[
            style,
            { backgroundColor: checked ? colors.basil : colors.butter },
          ]}
        >
          {checked ? <Text tone="inverse">✓</Text> : null}
        </Animated.View>
      </Pressable>
      <Text
        style={{
          minWidth: 70,
          fontFamily: fonts.manrope700,
          color: checked ? colors.olive : colors.espresso,
        }}
      >
        {qty}
      </Text>
      <Pressable className="min-h-11 flex-1 justify-center" onPress={onInfo}>
        <Text
          style={{
            color: checked ? colors.olive : colors.cocoa,
            textDecorationLine: checked ? 'line-through' : 'none',
          }}
        >
          {name}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add ${name}`}
        onPress={onAdd}
        className="h-11 w-11 items-center justify-center rounded-[12px] bg-linen"
      >
        <Text className="text-[15px]" tone="muted">
          +
        </Text>
      </Pressable>
    </View>
  );
}

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const catalog = useCatalog();
  const fetched = useRecipe(id);
  const recipe = fetched.data ?? catalog.get(id ?? '');
  const servingsByRecipe = useKitchenStore((state) => state.servingsByRecipe);
  const setServings = useKitchenStore((state) => state.setServings);
  const savedIds = useKitchenStore((state) => state.savedIds);
  const toggleSaved = useKitchenStore((state) => state.toggleSaved);
  const confirmReviewed = useKitchenStore((state) => state.confirmReviewed);
  const inboxStatus = useKitchenStore((state) => state.inboxStatus);
  const pantryStaples = useKitchenStore((state) => state.pantryStaples);
  const addIngredients = useShopStore((state) => state.addIngredients);
  const startCook = useCookStore((state) => state.start);
  const showToast = useUiStore((state) => state.showToast);
  const [showMore, setShowMore] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [info, setInfo] = useState<{ title: string; body: string } | null>(
    null,
  );
  const heart = usePopScale();
  const servings = recipe
    ? (servingsByRecipe[recipe.id] ?? recipe.servings)
    : 1;
  const servingsPop = usePopScale(servings);

  if (!recipe) {
    return (
      <Screen className="px-5">
        <Text variant="display">Recipe</Text>
      </Screen>
    );
  }
  const mult = servings / recipe.servings;
  const plan = planRecipe(recipe);
  const saved = savedIds.includes(recipe.id);
  const have = recipe.ingredients.filter((ing) =>
    isHave(ing.name, pantryStaples),
  );
  const need = recipe.ingredients.filter(
    (ing) => !isHave(ing.name, pantryStaples),
  );
  const status = inboxStatus[recipe.id];

  return (
    <Screen edges={['left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-10"
      >
        <View>
          <PhotoStandIn
            colors={recipe.placeholder}
            height={268}
            radius={0}
            uri={recipe.thumbnailUrl}
            label={`photo — ${recipe.title.toLowerCase()}`}
          />
          <View className="absolute left-4 top-12 flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => router.back()}
              className="bg-white/86 h-11 w-11 items-center justify-center rounded-[14px]"
            >
              <Text className="text-[22px]">‹</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove from saved' : 'Save recipe'}
            accessibilityState={{ selected: saved }}
            onPress={() => {
              hapticLight().catch(() => undefined);
              heart.pop();
              if (!saved) {
                confirmReviewed(recipe.id);
              }
              toggleSaved(recipe.id);
              showToast({
                text: saved
                  ? 'Removed from your kitchen'
                  : 'Saved to your kitchen',
                glyph: saved ? '·' : '♥',
              });
            }}
            className="absolute right-4 top-12 h-11 w-11 items-center justify-center rounded-[14px]"
            style={{
              backgroundColor: saved
                ? colors.paprika
                : 'rgba(255,255,255,0.86)',
            }}
          >
            <Animated.View style={heart.style}>
              <Text tone={saved ? 'inverse' : 'default'}>
                {saved ? '♥' : '♡'}
              </Text>
            </Animated.View>
          </Pressable>
        </View>

        <View className="px-5 pt-4">
          <View className="flex-row items-center gap-2 pb-2">
            <SourceIcon source={recipe.sourceLabel} size={16} />
            <Text variant="caption">
              {recipe.sourceLabel} · {recipe.creator}
            </Text>
          </View>
          <Text variant="display" accessibilityRole="header">
            {recipe.title}
          </Text>

          {status ? (
            <View className="mt-4 rounded-[16px] bg-[#FFF8E1] p-4">
              <Text variant="kicker" style={{ color: '#7A5B0C' }}>
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

          <Button
            label="Start cooking"
            size="lg"
            className="mt-5 h-[58px]"
            onPress={() => {
              if (status) {
                confirmReviewed(recipe.id);
              }
              startCook(recipe.id);
              router.push(`/cook/${recipe.id}`);
            }}
          />

          <View className="mt-5 flex-row flex-wrap items-center gap-2 rounded-[16px] bg-linen p-3">
            {plan.stages.map((stage, index) => (
              <View key={stage.name} className="flex-row items-center gap-2">
                <View className="rounded-full bg-bg px-3 py-1.5">
                  <Text className="text-[12px]">
                    {stage.name} · {stage.mins}m
                  </Text>
                </View>
                {index < plan.stages.length - 1 ? (
                  <Text tone="disabled">→</Text>
                ) : null}
              </View>
            ))}
          </View>

          <View className="mt-6 flex-row items-center justify-between">
            <Text variant="section">SERVINGS</Text>
            <View className="flex-row items-center gap-3">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Decrease servings"
                onPress={() => setServings(recipe.id, servings - 1)}
                className="h-11 w-11 items-center justify-center rounded-[14px] bg-peach"
              >
                <Text className="text-[18px]">−</Text>
              </Pressable>
              <Animated.View style={servingsPop.style}>
                <Text
                  className="min-w-[34px] text-center text-[17px]"
                  style={{ fontFamily: fonts.manrope700 }}
                >
                  {servings}
                </Text>
              </Animated.View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Increase servings"
                onPress={() => setServings(recipe.id, servings + 1)}
                className="h-11 w-11 items-center justify-center rounded-[14px] bg-peach"
              >
                <Text className="text-[18px]">+</Text>
              </Pressable>
            </View>
          </View>
          <Text variant="caption" className="pt-2">
            {servings === recipe.servings
              ? 'Detected from the source · tap to change'
              : `Scaled from ${recipe.servings} · quantities updated`}
          </Text>

          {have.length ? (
            <View className="mt-5">
              <Text variant="section">YOU HAVE · {have.length}</Text>
              <View className="mt-2 flex-row flex-wrap gap-2">
                {have.map((ing) => (
                  <View
                    key={ing.id}
                    className="rounded-[12px] bg-secondary-soft px-3 py-2"
                  >
                    <Text
                      className="text-[13px]"
                      style={{ color: colors.basil700 }}
                    >
                      {ing.name}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {need.length ? (
            <View className="mt-5">
              <View className="flex-row items-center justify-between">
                <Text variant="section">TO BUY · {need.length}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    addIngredients(need, recipe.title);
                    hapticSuccess().catch(() => undefined);
                    showToast({
                      text: `${need.length} ingredients added`,
                      glyph: '↓',
                      action: 'View',
                      onAction: () => router.push('/shop'),
                    });
                  }}
                  className="min-h-11 justify-center"
                >
                  <Text className="text-[13px]" tone="primary">
                    Add {need.length} to shopping list
                  </Text>
                </Pressable>
              </View>
              {need.map((ing) => {
                const on = !!checked[ing.id];
                return (
                  <NeedRow
                    key={ing.id}
                    name={ing.name}
                    qty={formatQty(ing.quantity, ing.unit, mult)}
                    checked={on}
                    onToggle={() =>
                      setChecked((curr) => ({ ...curr, [ing.id]: !on }))
                    }
                    onInfo={() =>
                      setInfo({
                        title: `${formatQty(ing.quantity, ing.unit, mult)} ${ing.name}`,
                        body: `Shows up in ${ing.category} on your shopping list. Scaled for ${servings} servings.`,
                      })
                    }
                    onAdd={() => {
                      addIngredients([ing], recipe.title);
                      showToast({
                        text: `${ing.name} added to Shopping`,
                        glyph: '↓',
                      });
                    }}
                  />
                );
              })}
            </View>
          ) : (
            <Text variant="caption" className="mt-4">
              You have everything for this one.
            </Text>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={() => setShowMore((value) => !value)}
            className="mt-4 min-h-11 flex-row items-center justify-between"
          >
            <Text tone="muted">
              {showMore ? 'Less' : 'Nutrition, notes, source & editing'}
            </Text>
            <Text>{showMore ? '↑' : '↓'}</Text>
          </Pressable>
          {showMore
            ? [
                { label: 'Nutrition estimate', hint: 'per serving' },
                { label: 'Original source', hint: recipe.sourceLabel },
                {
                  label: 'Edit the extraction',
                  hint: `${recipe.ingredients.length} fields`,
                },
              ].map((row) => (
                <Pressable
                  key={row.label}
                  onPress={() =>
                    showToast({
                      text: `${row.label} — prototype stub`,
                      glyph: '›',
                    })
                  }
                  className="min-h-11 flex-row items-center justify-between border-b border-crust py-3"
                >
                  <Text tone="icon">{row.label}</Text>
                  <Text variant="caption">{row.hint}</Text>
                </Pressable>
              ))
            : null}
        </View>
      </ScrollView>
      <Sheet
        visible={!!info}
        onClose={() => setInfo(null)}
        accessibilityLabel="Ingredient"
      >
        <Text variant="kicker">INGREDIENT</Text>
        <Text variant="title" className="py-2">
          {info?.title}
        </Text>
        <Text variant="caption">{info?.body}</Text>
        <Button
          label="Got it"
          variant="inverse"
          className="mt-5"
          onPress={() => setInfo(null)}
        />
      </Sheet>
    </Screen>
  );
}
