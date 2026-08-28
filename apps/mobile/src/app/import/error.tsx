import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { SourceIcon } from '@/components/icons/source-icon';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors } from '@/theme/tokens';

export default function ImportErrorScreen() {
  const { code = 'EXTRACTION_FAILED', source } = useLocalSearchParams<{
    code?: string;
    source?: string;
  }>();

  const unsupported = code === 'UNSUPPORTED_SOURCE' || code === 'INVALID_URL';
  const title = unsupported ? 'This video is private' : 'We couldn’t read that';
  const body = unsupported
    ? `${source ?? 'That source'} isn’t available yet — or the link is locked. Try a website, Instagram or YouTube URL.`
    : 'The extraction failed. Check the link and try again.';

  return (
    <Screen className="px-5">
      <ScrollView contentContainerClassName="flex-1 justify-center pb-10">
        {source ? (
          <View className="mb-5 self-start">
            <SourceIcon source={String(source)} size={52} />
            <View
              className="absolute -right-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full"
              style={{ backgroundColor: colors.chili }}
            >
              <Text className="text-[13px]" tone="inverse">
                !
              </Text>
            </View>
          </View>
        ) : (
          <View
            className="mb-5 h-[70px] w-[70px] items-center justify-center rounded-full"
            style={{ backgroundColor: colors.chili50 }}
          >
            <Text className="text-[28px]" style={{ color: colors.chili }}>
              !
            </Text>
          </View>
        )}
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
