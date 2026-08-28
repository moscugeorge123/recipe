import { Link, Stack } from 'expo-router';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View className="flex-1 items-center justify-center bg-bg px-6">
        <Text variant="title" className="mb-2">
          This screen does not exist.
        </Text>
        <Link href="/" className="mt-4 min-h-11 justify-center">
          <Text tone="primary">Go to home</Text>
        </Link>
      </View>
    </>
  );
}
