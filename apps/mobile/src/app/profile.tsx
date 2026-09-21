import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { ChevronLeft } from '@/components/icons/chevron-left';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import type { ReduceMotionPref } from '@/stores/contracts';
import { usePreferencesStore } from '@/stores/preferences-store';

export default function ProfileScreen() {
  const displayName = usePreferencesStore((state) => state.displayName);
  const units = usePreferencesStore((state) => state.units);
  const reduceMotion = usePreferencesStore((state) => state.reduceMotion);
  const setUnits = usePreferencesStore((state) => state.setUnits);
  const setReduceMotion = usePreferencesStore((state) => state.setReduceMotion);
  const replayOnboarding = usePreferencesStore(
    (state) => state.replayOnboarding,
  );

  const rows: {
    label: string;
    hint: string;
    onTap: () => void;
  }[] = [
    {
      label: 'Component gallery',
      hint: '',
      onTap: () => router.push('/ui-gallery' as Href),
    },
    {
      label: 'Units',
      hint: units,
      onTap: () => setUnits(units === 'metric' ? 'imperial' : 'metric'),
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
  ];

  return (
    <Screen>
      <View className="flex-row items-center gap-2 px-2 pb-2 pt-1">
        <IconButton accessibilityLabel="Back" onPress={() => router.back()}>
          <ChevronLeft />
        </IconButton>
        <Text variant="display" accessibilityRole="header">
          {displayName}
        </Text>
      </View>
      <ScrollView
        contentContainerClassName="px-5 pb-10"
        showsVerticalScrollIndicator={false}
      >
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
    </Screen>
  );
}
