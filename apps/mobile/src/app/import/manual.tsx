import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { SourceIcon } from '@/components/icons/source-icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { inspectClipboard } from '@/features/capture/sources';
import { useUiStore } from '@/stores/ui-store';

export default function ManualImportScreen() {
  const { paste = '' } = useLocalSearchParams<{ paste?: string }>();
  const [value, setValue] = useState(String(paste));
  const showToast = useUiStore((state) => state.showToast);

  const submit = () => {
    const offer = inspectClipboard(value.trim());
    if (offer.kind !== 'url') {
      showToast({
        text: 'Only recipe URLs can be extracted today',
        glyph: '↗',
      });
      return;
    }
    router.push({
      pathname: '/import/preview',
      params: { source: offer.source, url: offer.url },
    });
  };

  return (
    <Screen className="px-5">
      <KeyboardAwareScrollView contentContainerClassName="pt-2">
        <Text variant="display">Paste a recipe.</Text>
        <Text variant="caption" className="py-3">
          Drop in a link from Instagram, YouTube or the web. Photos and notes
          need a URL for now.
        </Text>
        <View className="flex-row gap-2 pb-4">
          {['Instagram', 'YouTube', 'Website', 'Photo', 'Text'].map(
            (source) => (
              <SourceIcon key={source} source={source} size={28} />
            ),
          )}
        </View>
        <Input
          label="URL or text"
          value={value}
          onChangeText={setValue}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://"
        />
        <View className="mt-5">
          <Button label="Make it a recipe" size="lg" onPress={submit} />
        </View>
      </KeyboardAwareScrollView>
    </Screen>
  );
}
