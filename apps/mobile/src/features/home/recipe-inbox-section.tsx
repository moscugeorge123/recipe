import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { useCatalog } from '@/features/catalog/use-catalog';
import { RecipeCard } from '@/features/home/recipe-card';

export function RecipeInboxSection() {
  const catalog = useCatalog();
  const inboxItems = catalog.inbox;
  const inboxStatus = catalog.inboxStatus;

  if (!inboxItems.length) {
    return null;
  }

  return (
    <View>
      <View className="flex-row items-baseline justify-between px-5 pb-3">
        <SectionLabel>{`RECIPE INBOX · ${inboxItems.length}`}</SectionLabel>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="See all inbox"
          onPress={() => router.push('/kitchen')}
          className="min-h-11 justify-center"
        >
          <Text className="text-[12.5px]" tone="primary">
            See all
          </Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3 px-5 pb-[26px]"
      >
        {inboxItems.map((recipe) => {
          const status = inboxStatus[recipe.id];
          const badge =
            status === 'needs_review' ? 'NEEDS REVIEW' : 'READY TO COOK';
          return (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              width={168}
              photoHeight={132}
              badge={badge}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}
