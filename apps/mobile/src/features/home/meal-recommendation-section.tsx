import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { SourceIcon } from '@/components/icons/source-icon';
import { Chip } from '@/components/ui/chip';
import { PhotoStandIn } from '@/components/ui/photo-stand-in';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { useCatalog } from '@/features/catalog/use-catalog';
import { useKitchenStore } from '@/stores/kitchen-store';
import { typeface } from '@/theme/tokens';

export type MealSlot = 'breakfast' | 'brunch' | 'lunch' | 'dinner' | 'other';

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'BREAKFAST',
  brunch: 'BRUNCH',
  lunch: 'LUNCH',
  dinner: 'DINNER',
  other: 'A MEAL',
};

type MealRecommendationSectionProps = {
  slot?: MealSlot;
};

export function MealRecommendationSection({
  slot = 'dinner',
}: MealRecommendationSectionProps) {
  const catalog = useCatalog();
  const inboxStatus = useKitchenStore((state) => state.inboxStatus);
  const [mood, setMood] = useState<'quick' | 'comfort' | 'fresh' | null>(null);

  const pick = useMemo(() => {
    const idsByMood = {
      quick: ['seed:pistachio', 'seed:gnocchi'],
      comfort: ['seed:harissa', 'seed:dal'],
      fresh: ['seed:galette', 'seed:congee'],
    };
    const why = {
      quick: 'UNDER 30 MINUTES',
      comfort: 'SLOW AND EASY',
      fresh: 'LIGHT TONIGHT',
    };
    const ids = mood ? idsByMood[mood] : ['seed:harissa'];
    const recipe =
      catalog.get(ids.find((id) => !inboxStatus[id]) ?? ids[0] ?? '') ??
      catalog.recipes[0];
    return {
      recipe,
      why: mood ? why[mood] : 'YOU HAVE MOST OF THIS',
    };
  }, [catalog, inboxStatus, mood]);

  return (
    <View>
      <SectionLabel className="px-5 pb-3">{SLOT_LABELS[slot]}</SectionLabel>
      <View className="flex-row gap-2 px-5 pb-3.5">
        <Chip
          label="Under 30"
          selected={mood === 'quick'}
          onPress={() => setMood('quick')}
        />
        <Chip
          label="Comfort"
          selected={mood === 'comfort'}
          onPress={() => setMood('comfort')}
        />
        <Chip
          label="Fresh"
          selected={mood === 'fresh'}
          onPress={() => setMood('fresh')}
        />
      </View>
      {pick.recipe ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={pick.recipe.title}
          onPress={() => router.push(`/recipe/${pick.recipe?.id}`)}
          className="px-5 pb-[26px]"
        >
          <View className="overflow-hidden rounded-[18px]">
            <PhotoStandIn
              colors={pick.recipe.placeholder}
              height={230}
              radius={18}
              uri={pick.recipe.thumbnailUrl}
              label={`photo — ${pick.recipe.title.toLowerCase()}`}
            />
            <View className="absolute inset-0 justify-end bg-black/40 px-[18px] pb-[18px]">
              <Text
                className="pb-2 text-[10.5px] tracking-[0.14em]"
                tone="accent"
                style={typeface('regular')}
              >
                {pick.why}
              </Text>
              <Text
                tone="inverse"
                className="max-w-[250px] text-[25px] leading-[1.1]"
                style={typeface('semibold')}
              >
                {pick.recipe.title}
              </Text>
              <View className="flex-row items-center gap-1.5 pt-2.5">
                <SourceIcon source={pick.recipe.sourceLabel} size={14} />
                <Text
                  tone="inverse"
                  className="text-[13px]"
                  style={{ opacity: 0.74 }}
                >
                  {pick.recipe.minutes} min · serves {pick.recipe.servings} ·
                  from {pick.recipe.sourceLabel}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}
