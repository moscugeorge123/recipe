import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/section-label';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useCatalog } from '@/features/catalog/use-catalog';
import { RecipeCard } from '@/features/home/recipe-card';
import { useUiStore } from '@/stores/ui-store';

export function LatestAddedSection() {
  const catalog = useCatalog();
  const openCapture = useUiStore((state) => state.openCapture);
  const latest = useMemo(
    () =>
      catalog.recipes
        .filter((recipe) => recipe.createdAt)
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
        .slice(0, 3),
    [catalog.recipes],
  );

  if (!latest.length && catalog.isApiError) {
    return (
      <View className="px-5 pb-[26px]">
        <SectionLabel className="pb-3">LATEST ADDED</SectionLabel>
        <View className="rounded-card border border-crust bg-peach p-6">
          <Text variant="caption" className="pb-3">
            We couldn’t load your latest recipes. Check your connection and try
            again.
          </Text>
          <Button
            label="Retry"
            size="md"
            disabled={catalog.isApiFetching}
            onPress={() => {
              void catalog.refetch();
            }}
          />
        </View>
      </View>
    );
  }

  if (!latest.length && !catalog.isApiLoading) {
    return (
      <View className="px-5 pb-[26px]">
        <SectionLabel className="pb-3">LATEST ADDED</SectionLabel>
        <View className="rounded-card border border-crust bg-peach p-6">
          <Text variant="caption" className="pb-3">
            You haven’t added any recipes yet. Capture a link, photo or note to
            get started.
          </Text>
          <Button
            label="Add your first recipe"
            size="md"
            onPress={openCapture}
          />
        </View>
      </View>
    );
  }

  if (!latest.length) {
    return (
      <View className="px-5 pb-[26px]">
        <SectionLabel className="pb-3">LATEST ADDED</SectionLabel>
        <Skeleton height={180} />
      </View>
    );
  }

  return (
    <View>
      <SectionLabel className="px-5 pb-3">LATEST ADDED</SectionLabel>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3 px-5 pb-[26px]"
      >
        {latest.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            width={168}
            photoHeight={132}
          />
        ))}
      </ScrollView>
    </View>
  );
}
