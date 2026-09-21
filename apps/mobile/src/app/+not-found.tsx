import { Link, Stack } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Screen className="bg-bg px-6" edges={['top', 'left', 'right', 'bottom']}>
        <View className="flex-1 justify-center gap-3">
          <Text variant="kicker">Recime</Text>
          <Text variant="title">This page is not on the menu.</Text>
          <Text variant="caption" className="max-w-[280px] text-[15.5px]">
            The recipe or screen you wanted is not here. Head back to your
            kitchen.
          </Text>
          <Link href="/" className="mt-4 min-h-11 justify-center self-start">
            <Text tone="primary">Go to recipes</Text>
          </Link>
        </View>
      </Screen>
    </>
  );
}
