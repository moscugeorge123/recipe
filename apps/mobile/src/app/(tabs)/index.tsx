import { useCallback } from 'react';
import { RefreshControl, ScrollView } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { CookingNowCard } from '@/features/home/cooking-now-card';
import { HomeHeader } from '@/features/home/home-header';
import { KitchenSyncBanner } from '@/features/kitchen/kitchen-sync-banner';
import { LatestAddedSection } from '@/features/home/latest-added-section';
import { MyRecipesSection } from '@/features/home/my-recipes-section';
import { RecipeInboxSection } from '@/features/home/recipe-inbox-section';
import { useHomeRecipes } from '@/features/home/use-home-recipes';
import { colors } from '@/theme/tokens';

/**
 * Home composition (Agent 8): greeting → Cooking Now (when useful) →
 * Recipe Inbox (when useful) → Last uploaded → My recipes.
 * Do not add Tonight / From your kitchen / other feed sections here.
 */
export default function HomeScreen() {
  const latest = useHomeRecipes('latest');
  const engagement = useHomeRecipes('engagement');
  const refreshing = latest.isFetching || engagement.isFetching;

  const onRefresh = useCallback(() => {
    void latest.refetch();
    void engagement.refetch();
  }, [engagement, latest]);

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-8"
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing && !latest.isLoading && !engagement.isLoading
            }
            onRefresh={onRefresh}
            tintColor={colors.paprika}
          />
        }
      >
        <HomeHeader />
        <KitchenSyncBanner />
        <CookingNowCard />
        <RecipeInboxSection />
        <LatestAddedSection />
        <MyRecipesSection />
      </ScrollView>
    </Screen>
  );
}
