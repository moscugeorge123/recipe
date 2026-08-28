import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { SourceIcon } from '@/components/icons/source-icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useCreateExtraction } from '@/features/extraction/hooks/use-create-extraction';
import { ApiError } from '@/services/api-client';
import { useUiStore } from '@/stores/ui-store';

export default function ManualImportScreen() {
  const [value, setValue] = useState('');
  const create = useCreateExtraction();
  const showToast = useUiStore((state) => state.showToast);

  const looksLikeUrl = /^https?:\/\//i.test(value.trim());

  const submit = async () => {
    if (!looksLikeUrl) {
      showToast({
        text: 'Only recipe URLs can be extracted today',
        glyph: '↗',
      });
      return;
    }
    try {
      const result = await create.mutateAsync({ url: value.trim() });
      if (result.status === 'completed' && result.recipeId) {
        router.replace(`/import/review/${result.recipeId}`);
        return;
      }
      router.replace(`/import/extract/${result.jobId}`);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'EXTRACTION_FAILED';
      router.push({
        pathname: '/import/error',
        params: { code: code ?? 'EXTRACTION_FAILED' },
      });
    }
  };

  return (
    <Screen className="px-5">
      <ScrollView contentContainerClassName="pt-2">
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
          <Button
            label="Make it a recipe"
            size="lg"
            onPress={() => {
              submit().catch(() => undefined);
            }}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
