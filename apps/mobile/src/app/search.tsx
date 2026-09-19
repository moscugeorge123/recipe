import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, Search, X } from 'lucide-react-native';

import { Screen } from '@/components/ui/screen';
import { IconButton } from '@/components/ui/icon-button';
import { TextInput } from '@/components/ui/text-input';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { PhotoStandIn } from '@/components/ui/photo-stand-in';
import { useRecipeSearch } from '@/features/recipes/hooks/use-recipes';
import { mapRecipeListItem } from '@/features/recipes/mapper';
import { useKitchenStore } from '@/stores/kitchen-store';
import { colors, fonts } from '@/theme/tokens';

const SUGGESTIONS = [
  'pasta under 20 minutes',
  'something with potatoes',
  'recipes I got from Instagram',
  'quick chicken dinner',
];

function searchToken(query: string): string {
  return (
    query
      .trim()
      .toLowerCase()
      .replace(/quick |under \d+ minutes?|something with |recipes from /g, '')
      .trim()
      .split(' ')[0] ?? ''
  );
}

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const recent = useKitchenStore((state) => state.recentSearches);
  const addRecentSearch = useKitchenStore((state) => state.addRecentSearch);
  const q = query.trim().toLowerCase();
  const token = searchToken(query);
  const search = useRecipeSearch(token);
  const results = useMemo(
    () => (search.data?.items ?? []).map(mapRecipeListItem),
    [search.data?.items],
  );

  const caption = search.isError
    ? "Couldn't search right now"
    : token.length >= 1 &&
        (search.isLoading || (search.isPending && !search.data))
      ? 'Searching…'
      : `${results.length} in your kitchen · ${
          results.length ? 'sorted by time' : 'nothing yet'
        }`;

  return (
    <Screen className="px-5">
      <View className="flex-row items-center gap-2.5 pb-[18px] pt-1">
        <IconButton
          accessibilityLabel="Back"
          onPress={() => router.back()}
          className="-ml-[11px]"
        >
          <ChevronLeft size={22} color={colors.cocoa} strokeWidth={2.2} />
        </IconButton>
        <View
          className="h-12 flex-1 flex-row items-center gap-2.5 rounded-[15px] border border-crust px-[15px]"
          style={{ backgroundColor: colors.searchFill }}
        >
          <Search size={14} color={colors.olive} strokeWidth={2.2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="pasta under 20 minutes"
            placeholderTextColor={colors.olive}
            accessibilityLabel="Search recipes"
            className="h-full flex-1 text-[15.5px]"
            style={{
              fontFamily: fonts.manrope600,
              color: colors.espresso,
              paddingVertical: 0,
              textAlignVertical: 'center',
              includeFontPadding: false,
            }}
            onSubmitEditing={() => addRecentSearch(query)}
          />
          {query ? (
            <IconButton
              accessibilityLabel="Clear search"
              onPress={() => setQuery('')}
              style={{ backgroundColor: colors.linen }}
            >
              <X size={16} color={colors.steam} strokeWidth={2.2} />
            </IconButton>
          ) : null}
        </View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        {!q ? (
          <View>
            <SectionLabel className="pb-3">TRY ASKING</SectionLabel>
            {SUGGESTIONS.map((suggestion) => (
              <Pressable
                key={suggestion}
                accessibilityRole="button"
                onPress={() => setQuery(suggestion)}
                className="mb-2 min-h-11 flex-row items-center gap-[11px] rounded-[14px] border border-crust bg-bg-elevated px-[15px] py-[13px]"
              >
                <Text className="text-[14px]" tone="primary">
                  ↗
                </Text>
                <Text className="flex-1 text-[14.5px]" tone="icon">
                  {suggestion}
                </Text>
              </Pressable>
            ))}
            <SectionLabel className="pb-2 pt-6">RECENT</SectionLabel>
            <View className="flex-row flex-wrap gap-2">
              {recent.map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  onPress={() => setQuery(item)}
                  className="h-11 items-center justify-center rounded-[13px] bg-peach px-4"
                >
                  <Text className="text-[13.5px]" tone="muted">
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <View>
            <Text variant="caption" className="pb-3.5">
              {caption}
            </Text>
            {results.map((recipe) => (
              <Pressable
                key={recipe.id}
                accessibilityRole="button"
                onPress={() => {
                  addRecentSearch(query);
                  router.push(`/recipe/${recipe.id}`);
                }}
                className="mb-3.5 min-h-11 flex-row items-center gap-3.5"
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
                    className="text-[15.5px]"
                    style={{ fontFamily: fonts.manrope700 }}
                  >
                    {recipe.title}
                  </Text>
                  <Text variant="caption" className="pt-1.5 text-[12.5px]">
                    {recipe.minutes} min · matches “{query.trim()}”
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
