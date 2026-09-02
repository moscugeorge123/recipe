import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { DaisyMascot } from '@/components/daisy';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { importErrorCopy } from '@/lib/user-error';

export default function ImportErrorScreen() {
  const { code = 'EXTRACTION_FAILED', source } = useLocalSearchParams<{
    code?: string;
    source?: string;
  }>();
  const copy = importErrorCopy(
    Array.isArray(code) ? code[0] : code,
    Array.isArray(source) ? source[0] : source,
  );

  return (
    <Screen className="px-5">
      <ScrollView contentContainerClassName="flex-1 justify-center pb-10">
        <View className="mb-4 self-start">
          <DaisyMascot phase="error" size={132} showCards={false} />
        </View>
        <Text variant="display" accessibilityRole="header">
          {copy.title}
        </Text>
        <Text
          variant="caption"
          accessibilityRole="alert"
          className="max-w-[300px] py-4 text-[16px] leading-[1.45]"
        >
          {copy.message}
        </Text>
        <Button
          label="Try again"
          size="lg"
          onPress={() => router.replace('/import/preview')}
        />
        <Button
          label="Paste a different link"
          variant="ghost"
          onPress={() => router.replace('/import/manual')}
        />
      </ScrollView>
    </Screen>
  );
}
