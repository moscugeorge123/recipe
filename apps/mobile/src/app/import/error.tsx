import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { DaisyMascot } from '@/components/daisy';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';

export default function ImportErrorScreen() {
  const { code = 'EXTRACTION_FAILED', source } = useLocalSearchParams<{
    code?: string;
    source?: string;
  }>();

  const unsupported = code === 'UNSUPPORTED_SOURCE' || code === 'INVALID_URL';
  const title = unsupported
    ? 'This video is private'
    : "We couldn't read that one. Try again?";
  const body = unsupported
    ? `${source ?? 'That source'} isn’t available yet — or the link is locked. Try a website, Instagram or YouTube URL.`
    : 'The extraction failed. Check the link and try again.';

  return (
    <Screen className="px-5">
      <ScrollView contentContainerClassName="flex-1 justify-center pb-10">
        <View className="mb-4 self-start">
          <DaisyMascot phase="error" size={132} showCards={false} />
        </View>
        <Text variant="display">{title}</Text>
        <Text
          variant="caption"
          className="max-w-[300px] py-4 text-[16px] leading-[1.45]"
        >
          {body}
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
