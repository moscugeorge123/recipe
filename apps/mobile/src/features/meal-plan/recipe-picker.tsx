import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { TextInput } from '@/components/ui/text-input';
import { PhotoStandIn } from '@/components/ui/photo-stand-in';
import { Text } from '@/components/ui/text';
import { CoverMosaic } from '@/features/collections/cover-mosaic';
import { useCollection, useCollections } from '@/features/collections/hooks';
import {
  useRecipeSearch,
  useRecipes,
} from '@/features/recipes/hooks/use-recipes';
import { mapRecipeListItem } from '@/features/recipes/mapper';
import { colors, fonts } from '@/theme/tokens';

type RecipePickerProps = {
  selectedRecipeId: string | null;
  onSelect: (recipeId: string, title: string) => void;
};

export function RecipePicker({
  selectedRecipeId,
  onSelect,
}: RecipePickerProps) {
  const [query, setQuery] = useState('');
  const [cookbookId, setCookbookId] = useState<string | null>(null);
  const collections = useCollections();
  const recipesQuery = useRecipes(1, 50, { sort: 'latest' });
  const search = useRecipeSearch(query.trim());
  const cookbook = useCollection(cookbookId ?? undefined);
  const searchText = query.trim().toLowerCase();

  const cookbooks = useMemo(() => {
    const items = collections.data?.items ?? [];
    if (!searchText) {
      return items;
    }
    return items.filter((item) => item.name.toLowerCase().includes(searchText));
  }, [collections.data?.items, searchText]);

  const searchedRecipes = useMemo(() => {
    if (!searchText) {
      return [];
    }
    const items = search.data?.items ?? recipesQuery.data?.items ?? [];
    return items
      .filter((item) => item.title.toLowerCase().includes(searchText))
      .map(mapRecipeListItem);
  }, [recipesQuery.data?.items, search.data?.items, searchText]);

  const cookbookRecipes = useMemo(() => {
    return (cookbook.data?.recipes ?? []).map((item) =>
      mapRecipeListItem(item),
    );
  }, [cookbook.data?.recipes]);

  return (
    <View>
      <View
        className="mb-4 h-12 flex-row items-center rounded-[24px] border border-crust px-4"
        style={{ backgroundColor: colors.searchFill }}
      >
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search cookbooks and recipes"
          placeholderTextColor={colors.tabInactive}
          accessibilityLabel="Search cookbooks and recipes"
          className="h-full flex-1 text-[15px]"
          style={{
            fontFamily: fonts.manrope500,
            color: colors.espresso,
            paddingVertical: 0,
            textAlignVertical: 'center',
            includeFontPadding: false,
          }}
          returnKeyType="search"
        />
      </View>

      {cookbookId ? (
        <View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to cookbooks"
            onPress={() => setCookbookId(null)}
            className="min-h-11 justify-center pb-3"
          >
            <Text tone="muted">← Cookbooks</Text>
          </Pressable>
          {cookbook.isLoading && cookbookRecipes.length === 0 ? (
            <ContentSkeleton shape="grid" />
          ) : (
            <View className="flex-row flex-wrap gap-3.5">
              {cookbookRecipes.map((recipe) => (
                <RecipePickCard
                  key={recipe.id}
                  id={recipe.id}
                  title={recipe.title}
                  thumbnailUrl={recipe.thumbnailUrl}
                  placeholder={recipe.placeholder}
                  selected={selectedRecipeId === recipe.id}
                  onSelect={onSelect}
                />
              ))}
            </View>
          )}
        </View>
      ) : (
        <View>
          {searchText ? (
            <View className="flex-row flex-wrap gap-3.5 pb-4">
              {searchedRecipes.map((recipe) => (
                <RecipePickCard
                  key={recipe.id}
                  id={recipe.id}
                  title={recipe.title}
                  thumbnailUrl={recipe.thumbnailUrl}
                  placeholder={recipe.placeholder}
                  selected={selectedRecipeId === recipe.id}
                  onSelect={onSelect}
                />
              ))}
            </View>
          ) : null}
          <View className="flex-row flex-wrap gap-3.5">
            {cookbooks.map((collection) => (
              <Pressable
                key={collection.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${collection.name}`}
                onPress={() => setCookbookId(collection.id)}
                className="w-[47%] rounded-[18px] border border-crust bg-bg-elevated p-[15px]"
              >
                <CoverMosaic
                  covers={collection.coverPreviews.map((cover) => ({
                    recipeId: cover.recipeId,
                    thumbnailUrl: cover.thumbnailUrl,
                  }))}
                />
                <Text
                  style={{ fontFamily: fonts.manrope700 }}
                  className="text-[15px]"
                >
                  {collection.name}
                </Text>
                <Text variant="caption" className="pt-1.5 text-[12px]">
                  {collection.recipeCount}{' '}
                  {collection.recipeCount === 1 ? 'recipe' : 'recipes'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function RecipePickCard({
  id,
  title,
  thumbnailUrl,
  placeholder,
  selected,
  onSelect,
}: {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  placeholder: [string, string];
  selected: boolean;
  onSelect: (recipeId: string, title: string) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ selected }}
      onPress={() => onSelect(id, title)}
      className="w-[47%]"
      testID={`pick-recipe-${id}`}
    >
      <View
        className="overflow-hidden rounded-[16px]"
        style={
          selected ? { borderWidth: 2, borderColor: colors.cta } : undefined
        }
      >
        <PhotoStandIn
          colors={placeholder}
          height={118}
          radius={16}
          uri={thumbnailUrl}
          label="photo"
        />
      </View>
      <Text
        className="pt-[10px] text-[15px] leading-[1.28]"
        style={{ fontFamily: fonts.manrope700 }}
        numberOfLines={2}
      >
        {title}
      </Text>
    </Pressable>
  );
}
