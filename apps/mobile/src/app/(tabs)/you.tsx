import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';

import { Screen } from '@/components/ui/screen';
import { SectionLabel } from '@/components/ui/section-label';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { Chip } from '@/components/ui/chip';
import { useCatalog } from '@/features/catalog/use-catalog';
import { DisplayNameForm } from '@/features/settings/components/display-name-form';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useUiStore } from '@/stores/ui-store';
import type { CookingTheme, ReduceMotionPref } from '@/stores/contracts';

export default function YouScreen() {
  const displayName = usePreferencesStore((state) => state.displayName);
  const tasteTags = usePreferencesStore((state) => state.tasteTags);
  const cookingTheme = usePreferencesStore((state) => state.cookingTheme);
  const reduceMotion = usePreferencesStore((state) => state.reduceMotion);
  const units = usePreferencesStore((state) => state.units);
  const setCookingTheme = usePreferencesStore((state) => state.setCookingTheme);
  const setReduceMotion = usePreferencesStore((state) => state.setReduceMotion);
  const setUnits = usePreferencesStore((state) => state.setUnits);
  const replayOnboarding = usePreferencesStore(
    (state) => state.replayOnboarding,
  );
  const showToast = useUiStore((state) => state.showToast);
  const catalog = useCatalog();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const cooked = Object.values(catalog.cookedCounts).reduce(
    (sum, n) => sum + n,
    0,
  );
  const imported = catalog.recipes.filter(
    (recipe) => recipe.origin === 'api',
  ).length;
  const firstName = displayName.split(' ')[0] ?? displayName;

  const rows: {
    label: string;
    hint: string;
    onTap: () => void;
  }[] = [
    {
      label: 'Cooking history',
      hint: `${cooked} sessions`,
      onTap: () =>
        showToast({ text: 'Cooking history — prototype stub', glyph: '›' }),
    },
    {
      label: 'Units',
      hint: units,
      onTap: () => setUnits(units === 'metric' ? 'imperial' : 'metric'),
    },
    {
      label: 'Cooking appearance',
      hint: cookingTheme === 'dark' ? 'Dark kitchen' : 'Light kitchen',
      onTap: () =>
        setCookingTheme(
          (cookingTheme === 'dark' ? 'light' : 'dark') as CookingTheme,
        ),
    },
    {
      label: 'Reduce motion',
      hint: reduceMotion,
      onTap: () => {
        const next: ReduceMotionPref =
          reduceMotion === 'system'
            ? 'reduce'
            : reduceMotion === 'reduce'
              ? 'full'
              : 'system';
        setReduceMotion(next);
      },
    },
    {
      label: 'Replay onboarding',
      hint: '',
      onTap: () => {
        replayOnboarding();
        router.replace('/onboarding');
      },
    },
    {
      label: 'Notifications',
      hint: 'timers only',
      onTap: () =>
        showToast({ text: 'Notifications — timers only', glyph: '›' }),
    },
    {
      label: 'Settings',
      hint: '',
      onTap: () => setSettingsOpen(true),
    },
  ];

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="px-5 pb-10"
        showsVerticalScrollIndicator={false}
      >
        <Text variant="display" accessibilityRole="header" className="pt-1">
          {firstName}
          {"'s cooking"}
        </Text>
        <Text variant="caption" className="pb-5 pt-2">
          Six weeks in · 3 dinners a week
        </Text>
        <View className="flex-row gap-2.5 pb-5">
          {[
            { v: String(cooked || 7), k: 'recipes cooked' },
            { v: String(imported || 21), k: 'imported' },
            { v: String(catalog.savedIds.length || 46), k: 'saved' },
          ].map((stat) => (
            <View
              key={stat.k}
              className="flex-1 rounded-[17px] border border-crust bg-bg-elevated px-[13px] py-[15px]"
            >
              <Text variant="display" className="text-[25px]">
                {stat.v}
              </Text>
              <Text variant="caption" className="pt-2 text-[11.5px]">
                {stat.k}
              </Text>
            </View>
          ))}
        </View>
        <SectionLabel className="pb-3">YOU COOK MOSTLY</SectionLabel>
        <View className="flex-row flex-wrap gap-2 pb-6">
          {(tasteTags.length
            ? tasteTags
            : [
                'Italian',
                'Korean',
                'North African',
                'Indian',
                'Quick weeknights',
              ]
          ).map((tag) => (
            <Chip key={tag} label={tag} />
          ))}
        </View>
        {rows.map((row) => (
          <Pressable
            key={row.label}
            accessibilityRole="button"
            onPress={row.onTap}
            className="min-h-11 flex-row items-center justify-between border-b border-crust py-4"
          >
            <Text className="text-[15px]" tone="icon">
              {row.label}
            </Text>
            <Text variant="caption">{row.hint}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Sheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        accessibilityLabel="Settings"
      >
        <Text variant="title" className="pb-4">
          Settings
        </Text>
        <DisplayNameForm />
      </Sheet>
    </Screen>
  );
}
