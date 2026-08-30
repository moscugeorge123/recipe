import { ScrollView } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { CookingNowCard } from '@/features/home/cooking-now-card';
import { HomeHeader } from '@/features/home/home-header';
import { LatestAddedSection } from '@/features/home/latest-added-section';
import { RecipeInboxSection } from '@/features/home/recipe-inbox-section';

export default function HomeScreen() {
  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-8"
      >
        <HomeHeader />
        <CookingNowCard />
        <RecipeInboxSection />
        <LatestAddedSection />
      </ScrollView>
    </Screen>
  );
}
