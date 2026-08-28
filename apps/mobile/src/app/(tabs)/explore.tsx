import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { SourceIcon } from '@/components/icons/source-icon';
import { Chip } from '@/components/ui/chip';
import { PhotoStandIn } from '@/components/ui/photo-stand-in';
import { Screen } from '@/components/ui/screen';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { useCatalog } from '@/features/catalog/use-catalog';
import { RecipeCard } from '@/features/home/recipe-card';
import { fonts } from '@/theme/tokens';

const FILTERS = [
  'Under 30',
  'One-pan',
  'Seasonal',
  'Comfort',
  'Air fryer',
  'Batch cook',
];

export default function ExploreScreen() {
  const { recipes } = useCatalog();
  const under30 = recipes.filter((recipe) => recipe.minutes < 30);
  const hero =
    recipes.find((recipe) => recipe.id === 'seed:galette') ?? recipes[0];
  const creators = Array.from(
    recipes.reduce((map, recipe) => {
      const current = map.get(recipe.creator) ?? {
        name: recipe.creator,
        count: 0,
        source: recipe.sourceLabel,
      };
      current.count += 1;
      map.set(recipe.creator, current);
      return map;
    }, new Map<string, { name: string; count: number; source: string }>()),
  ).map(([, value]) => value);

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-8"
      >
        <View className="px-5 pb-4 pt-1">
          <Text variant="display" accessibilityRole="header">
            Explore
          </Text>
          <Text variant="caption" className="pt-2">
            Edited weekly. Nothing endless.
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-5 pb-5"
        >
          {FILTERS.map((label, index) => (
            <Chip key={label} label={label} selected={index === 0} />
          ))}
        </ScrollView>
        {hero ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/recipe/${hero.id}`)}
            className="px-5 pb-6"
          >
            <View className="overflow-hidden rounded-[22px]">
              <PhotoStandIn
                colors={hero.placeholder}
                height={220}
                radius={22}
                uri={hero.thumbnailUrl}
                label="photo — editorial"
              />
              <View className="absolute inset-0 justify-end bg-black/50 px-[18px] pb-[18px]">
                <Text
                  className="text-[10.5px] tracking-[0.14em]"
                  tone="accent"
                  style={{ fontFamily: fonts.mono500 }}
                >
                  THE 25-MINUTE ISSUE
                </Text>
                <Text
                  tone="inverse"
                  className="max-w-[240px] pt-2 text-[24px] leading-[1.12]"
                  style={{ fontFamily: fonts.manrope800 }}
                >
                  Six dinners for the nights you have nothing left
                </Text>
              </View>
            </View>
          </Pressable>
        ) : null}
        <SectionLabel className="px-5 pb-3">UNDER 30 MINUTES</SectionLabel>
        <View className="flex-row flex-wrap gap-[14px] px-5 pb-[26px]">
          {(under30.length ? under30 : recipes).slice(0, 4).map((recipe) => (
            <View key={recipe.id} className="w-[47%]">
              <RecipeCard
                recipe={recipe}
                photoHeight={112}
                meta={`${recipe.minutes} min · ${recipe.difficulty} · serves ${recipe.servings}`}
              />
            </View>
          ))}
        </View>
        <SectionLabel className="px-5 pb-3">
          CREATORS YOU IMPORT FROM
        </SectionLabel>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2.5 px-5"
        >
          {creators.map((creator) => (
            <View
              key={creator.name}
              className="w-[132px] rounded-[18px] border border-crust bg-bg-elevated p-3.5"
            >
              <SourceIcon source={creator.source} size={34} />
              <Text
                className="pt-2.5 text-[14px]"
                style={{ fontFamily: fonts.manrope700 }}
              >
                {creator.name}
              </Text>
              <Text variant="caption" className="pt-1 text-[11.5px]">
                {creator.count} imports · {creator.source}
              </Text>
            </View>
          ))}
        </ScrollView>
      </ScrollView>
    </Screen>
  );
}
