import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { SourceIcon } from '@/components/icons/source-icon';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { PhotoStandIn } from '@/components/ui/photo-stand-in';
import { Screen } from '@/components/ui/screen';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { useCatalog } from '@/features/catalog/use-catalog';
import type { KitchenTab } from '@/stores/contracts';
import { useKitchenStore } from '@/stores/kitchen-store';
import { useUiStore } from '@/stores/ui-store';
import { colors, fonts } from '@/theme/tokens';

const TABS: KitchenTab[] = [
  'Inbox',
  'Saved',
  'Want to cook',
  'Cooked',
  'Collections',
];

export default function KitchenScreen() {
  const catalog = useCatalog();
  const [tab, setTab] = useState<KitchenTab>('Inbox');
  const [source, setSource] = useState('All');
  const [time, setTime] = useState('Any');
  const [filterOpen, setFilterOpen] = useState(false);
  const showToast = useUiStore((state) => state.showToast);
  const openCapture = useUiStore((state) => state.openCapture);
  const addCollection = useKitchenStore((state) => state.addCollection);

  const pass = (id: string) => {
    const recipe = catalog.get(id);
    if (!recipe) {
      return false;
    }
    if (source !== 'All' && recipe.sourceLabel !== source) {
      return false;
    }
    if (time === 'Under 30' && !(recipe.minutes < 30)) {
      return false;
    }
    if (time === '30–60' && !(recipe.minutes >= 30 && recipe.minutes <= 60)) {
      return false;
    }
    if (time === 'Over 60' && !(recipe.minutes > 60)) {
      return false;
    }
    return true;
  };

  const inboxIds = Object.keys(catalog.inboxStatus).filter(pass);
  const savedIds = catalog.savedIds.filter(
    (id) => !catalog.inboxStatus[id] && pass(id),
  );
  const wantIds = catalog.wantIds.filter(pass);
  const cookedIds = Object.keys(catalog.cookedCounts).filter(pass);
  const filtersOn = source !== 'All' || time !== 'Any';

  const listIds =
    tab === 'Saved'
      ? savedIds
      : tab === 'Want to cook'
        ? wantIds
        : tab === 'Cooked'
          ? cookedIds
          : [];

  const emptyCopy = {
    Inbox: {
      title: 'All caught up.',
      body: 'Nothing waiting on you right now.',
      cta: 'Capture something',
      onTap: openCapture,
    },
    Saved: {
      title: 'Nothing saved yet.',
      body: 'Recipes you save land here.',
      cta: 'Explore recipes',
      onTap: () => router.push('/explore'),
    },
    'Want to cook': {
      title: 'Nothing on the list.',
      body: 'Save something for later.',
      cta: 'Explore recipes',
      onTap: () => router.push('/explore'),
    },
    Cooked: {
      title: 'Nothing cooked yet.',
      body: 'Finish a recipe and it lands here.',
      cta: 'Find something to cook',
      onTap: () => router.push('/explore'),
    },
  } as const;

  const counts = useMemo(
    () => ({
      Inbox: inboxIds.length,
      Saved: savedIds.length,
      'Want to cook': wantIds.length,
      Cooked: cookedIds.length,
      Collections: catalog.collections.length,
    }),
    [
      catalog.collections.length,
      cookedIds.length,
      inboxIds.length,
      savedIds.length,
      wantIds.length,
    ],
  );

  const empty =
    tab !== 'Collections' &&
    (tab === 'Inbox' ? !inboxIds.length : !listIds.length)
      ? filtersOn
        ? {
            title: 'Nothing matches those filters.',
            body: 'Try widening the source or time filter.',
            cta: 'Clear filters',
            onTap: () => {
              setSource('All');
              setTime('Any');
            },
          }
        : emptyCopy[tab]
      : null;

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="pb-8"
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pb-4 pt-1">
          <Text variant="display" accessibilityRole="header">
            My kitchen
          </Text>
          <Text variant="caption" className="pt-2">
            {catalog.savedIds.length} saved · {catalog.collections.length}{' '}
            collections · {Object.keys(catalog.inboxStatus).length} in your
            inbox
          </Text>
        </View>
        <View className="flex-row items-center gap-2.5 px-5 pb-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filter your kitchen"
            onPress={() => setFilterOpen(true)}
            className="h-[46px] min-h-11 flex-1 flex-row items-center justify-between rounded-[14px] border border-crust bg-bg-elevated px-3.5"
          >
            <Text className="text-[14px]">
              {tab} ·{' '}
              {tab === 'Collections' ? catalog.collections.length : counts[tab]}
            </Text>
            <View className="flex-row items-center gap-2">
              {filtersOn ? (
                <View className="h-1.5 w-1.5 rounded-full bg-primary" />
              ) : null}
              <Text className="text-[11px]" tone="muted">
                ▾
              </Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/shop')}
            className="h-[46px] min-h-11 justify-center rounded-[14px] bg-peach px-4"
          >
            <Text className="text-[13px]" tone="icon">
              Shopping →
            </Text>
          </Pressable>
        </View>

        {tab === 'Inbox' && !empty ? (
          <View className="px-5">
            {(['needs_review', 'ready'] as const).map((status) => {
              const ids = inboxIds.filter(
                (id) => catalog.inboxStatus[id] === status,
              );
              if (!ids.length) {
                return null;
              }
              return (
                <View key={status} className="pb-1">
                  <Text
                    variant="mono"
                    className="py-3 text-[11.5px] tracking-[0.14em]"
                  >
                    {status === 'needs_review'
                      ? 'NEEDS REVIEW'
                      : 'READY TO COOK'}
                  </Text>
                  {ids.map((id) => {
                    const recipe = catalog.get(id);
                    if (!recipe) {
                      return null;
                    }
                    return (
                      <Pressable
                        key={id}
                        accessibilityRole="button"
                        onPress={() => router.push(`/recipe/${id}`)}
                        className="min-h-11 flex-row items-center gap-3.5 border-b border-crust py-[11px]"
                      >
                        <PhotoStandIn
                          colors={recipe.placeholder}
                          height={62}
                          radius={13}
                          uri={recipe.thumbnailUrl}
                          className="w-[62px]"
                        />
                        <View className="flex-1">
                          <Text
                            style={{ fontFamily: fonts.manrope700 }}
                            className="text-[15.5px]"
                          >
                            {recipe.title}
                          </Text>
                          <Text
                            variant="caption"
                            className="pt-1.5 text-[12.5px]"
                          >
                            {recipe.minutes} min · {recipe.difficulty} · serves{' '}
                            {recipe.servings}
                          </Text>
                        </View>
                        <Text className="text-[12.5px]" tone="primary">
                          {status === 'needs_review' ? 'Review' : 'Cook'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
          </View>
        ) : null}

        {tab !== 'Inbox' && tab !== 'Collections' && !empty ? (
          <View className="px-5">
            {listIds.map((id) => {
              const recipe = catalog.get(id);
              if (!recipe) {
                return null;
              }
              return (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  onPress={() => router.push(`/recipe/${id}`)}
                  className="min-h-11 flex-row items-center gap-3.5 border-b border-crust py-[11px]"
                >
                  <PhotoStandIn
                    colors={recipe.placeholder}
                    height={62}
                    radius={13}
                    uri={recipe.thumbnailUrl}
                    className="w-[62px]"
                  />
                  <View className="flex-1">
                    <Text
                      style={{ fontFamily: fonts.manrope700 }}
                      className="text-[15.5px]"
                    >
                      {recipe.title}
                    </Text>
                    <Text variant="caption" className="pt-1.5 text-[12.5px]">
                      {recipe.minutes} min · {recipe.difficulty} · serves{' '}
                      {recipe.servings}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    {tab !== 'Cooked' ? (
                      <SourceIcon source={recipe.sourceLabel} size={16} />
                    ) : null}
                    <Text variant="mono" className="text-[11.5px]">
                      {tab === 'Cooked'
                        ? `${catalog.cookedCounts[id] ?? 1}× cooked`
                        : recipe.sourceLabel}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {tab === 'Collections' ? (
          <View className="flex-row flex-wrap gap-3.5 px-5">
            {catalog.collections.map((collection) => (
              <Pressable
                key={collection.id}
                accessibilityRole="button"
                onPress={() =>
                  showToast({
                    text: `Opening “${collection.name}”`,
                    glyph: '›',
                  })
                }
                className="w-[47%] rounded-[18px] border border-crust bg-bg-elevated p-[15px]"
              >
                <View className="flex-row gap-1 pb-3">
                  {collection.recipeIds.slice(0, 3).map((id) => {
                    const recipe = catalog.get(id);
                    return (
                      <View key={id} className="flex-1">
                        <PhotoStandIn
                          colors={recipe?.placeholder ?? ['#E6D9C4', '#DCCBB0']}
                          height={44}
                          radius={9}
                          uri={recipe?.thumbnailUrl}
                        />
                      </View>
                    );
                  })}
                </View>
                <Text
                  style={{ fontFamily: fonts.manrope700 }}
                  className="text-[15px]"
                >
                  {collection.name}
                </Text>
                <Text variant="caption" className="pt-1.5 text-[12px]">
                  {collection.recipeIds.length} recipes
                </Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                addCollection('New collection');
                showToast({
                  text: 'New collection — name it anything',
                  glyph: '+',
                });
              }}
              className="min-h-[120px] w-[47%] items-center justify-center rounded-[18px] border-[1.5px] border-dashed border-crust"
            >
              <Text className="text-center text-[14px]" tone="muted">
                + New{'\n'}collection
              </Text>
            </Pressable>
          </View>
        ) : null}

        {empty ? (
          <View className="items-center px-5 pt-[30px]">
            <Text
              style={{ fontFamily: fonts.manrope700 }}
              className="text-[19px]"
            >
              {empty.title}
            </Text>
            <Text variant="caption" className="py-2.5 text-center">
              {empty.body}
            </Text>
            <Button label={empty.cta} size="md" onPress={empty.onTap} />
          </View>
        ) : null}
      </ScrollView>

      <Sheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        accessibilityLabel="Filter your kitchen"
      >
        <Text variant="title" className="pb-4">
          Filter your kitchen
        </Text>
        <Text variant="mono" className="pb-2">
          SHOW
        </Text>
        {TABS.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="radio"
            accessibilityState={{ selected: tab === item }}
            onPress={() => setTab(item)}
            className="min-h-11 flex-row items-center justify-between border-b border-crust py-[13px]"
          >
            <View className="flex-row items-center gap-[11px]">
              <View
                className="h-4 w-4 rounded-full border-2"
                style={{
                  borderColor: tab === item ? colors.paprika : colors.crust,
                  backgroundColor:
                    tab === item ? colors.paprika : 'transparent',
                }}
              />
              <Text className="text-[14.5px]" tone="icon">
                {item}
              </Text>
            </View>
            <Text variant="caption">{counts[item]}</Text>
          </Pressable>
        ))}
        <Text variant="mono" className="pb-2 pt-4">
          SOURCE
        </Text>
        <View className="flex-row flex-wrap gap-2 pb-4">
          {['All', 'Instagram', 'TikTok', 'YouTube', 'Website', 'Note'].map(
            (item) => (
              <Chip
                key={item}
                label={item}
                selected={source === item}
                icon={<SourceIcon source={item} size={16} />}
                onPress={() => setSource(item)}
              />
            ),
          )}
        </View>
        <Text variant="mono" className="pb-2">
          TIME
        </Text>
        <View className="flex-row flex-wrap gap-2 pb-5">
          {['Any', 'Under 30', '30–60', 'Over 60'].map((item) => (
            <Chip
              key={item}
              label={item}
              selected={time === item}
              onPress={() => setTime(item)}
            />
          ))}
        </View>
        <View className="flex-row gap-2.5">
          <Button
            label="Clear filters"
            variant="ghost"
            className="flex-1 bg-peach"
            onPress={() => {
              setSource('All');
              setTime('Any');
            }}
          />
          <Button
            label="Show results"
            variant="inverse"
            className="flex-[1.4]"
            onPress={() => setFilterOpen(false)}
          />
        </View>
      </Sheet>
    </Screen>
  );
}
