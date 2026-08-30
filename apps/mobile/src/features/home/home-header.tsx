import { router } from 'expo-router';
import { View } from 'react-native';

import { IconButton } from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';
import { useCatalog } from '@/features/catalog/use-catalog';
import { useActiveCook } from '@/features/cook-sessions/hooks';
import { usePreferencesStore } from '@/stores/preferences-store';

function formatKicker(now = new Date()): string {
  const weekday = now
    .toLocaleDateString('en-GB', { weekday: 'long' })
    .toUpperCase();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${weekday} · ${hours}:${minutes}`;
}

function greetingHour(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) {
    return 'Morning';
  }
  if (hour < 17) {
    return 'Afternoon';
  }
  return 'Evening';
}

export function HomeHeader() {
  const displayName = usePreferencesStore((state) => state.displayName);
  const firstName = displayName.split(' ')[0] ?? displayName;
  const catalog = useCatalog();
  const cooking = useActiveCook();
  const inboxItems = catalog.inbox;

  const greetLine = cooking.isVisible
    ? "Dinner's underway."
    : inboxItems.length
      ? "Something's ready for you."
      : 'What are we cooking?';

  return (
    <View className="flex-row items-start justify-between px-5 pb-[18px] pt-1">
      <View className="flex-1 pr-3">
        <Text variant="mono">{formatKicker()}</Text>
        <Text variant="display" accessibilityRole="header" className="pt-2">
          {greetingHour()}, {firstName}.{'\n'}
          {greetLine}
        </Text>
      </View>
      <IconButton
        accessibilityLabel="Search recipes"
        onPress={() => router.push('/search')}
      >
        <View className="h-[15px] w-[15px]">
          <View className="h-2.5 w-2.5 rounded-full border-2 border-olive" />
          <View className="absolute bottom-0 right-0 h-1.5 w-0.5 rotate-45 rounded-sm bg-olive" />
        </View>
      </IconButton>
    </View>
  );
}
