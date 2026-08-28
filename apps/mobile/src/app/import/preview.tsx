import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { SourceIcon } from '@/components/icons/source-icon';
import { Button } from '@/components/ui/button';
import { PhotoStandIn } from '@/components/ui/photo-stand-in';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useCreateExtraction } from '@/features/extraction/hooks/use-create-extraction';
import { SEED_RECIPES } from '@/features/recipes/seed';
import { ApiError } from '@/services/api-client';
import { useUiStore } from '@/stores/ui-store';
import { colors, fonts } from '@/theme/tokens';

export default function ImportPreviewScreen() {
  const { source = 'Instagram', url = '' } = useLocalSearchParams<{
    source?: string;
    url?: string;
  }>();
  const create = useCreateExtraction();
  const showToast = useUiStore((state) => state.showToast);
  const pistachio = SEED_RECIPES[0];
  const sourceLabel = String(source);

  const start = async () => {
    const extractUrl = String(url) || 'https://instagram.com/reel/C8xk2Rp9Lm/';
    try {
      const result = await create.mutateAsync({ url: extractUrl });
      if (result.status === 'completed' && result.recipeId) {
        router.replace(`/import/review/${result.recipeId}`);
        return;
      }
      router.replace(`/import/extract/${result.jobId}`);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'EXTRACTION_FAILED';
      router.push({
        pathname: '/import/error',
        params: { code: code ?? 'EXTRACTION_FAILED', source: sourceLabel },
      });
      showToast({ text: 'Could not start extraction', glyph: '!' });
    }
  };

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="px-5 pb-10"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center gap-1.5 pb-5 pt-1">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            className="-ml-[11px] h-11 w-11 items-center justify-center"
          >
            <Text className="text-[22px]" tone="icon">
              ‹
            </Text>
          </Pressable>
          <SourceIcon source={sourceLabel} size={22} />
          <Text className="text-[15px]">Importing from {sourceLabel}</Text>
        </View>
        <View className="mb-4 h-8 flex-row items-center gap-2 self-start rounded-[11px] bg-secondary-soft px-[13px]">
          <Text className="text-[13px]" style={{ color: colors.basil700 }}>
            ✓
          </Text>
          <Text className="text-[13px]" style={{ color: colors.basil700 }}>
            Recipe captured
          </Text>
        </View>
        <View className="overflow-hidden rounded-[20px] border border-crust bg-bg-elevated">
          <PhotoStandIn
            colors={pistachio?.placeholder ?? ['#E6D9C4', '#DCCBB0']}
            height={200}
            radius={0}
            label="video still"
          />
          <View className="p-4">
            <View className="flex-row items-center gap-2 pb-[11px]">
              <SourceIcon source={sourceLabel} size={16} />
              <Text className="text-[12.5px]" tone="muted">
                @noor.cooks
              </Text>
            </View>
            <Text className="text-[14.5px] leading-[1.5]" tone="icon">
              the pistachio pasta everyone keeps asking about — 320g rigatoni,
              big handful of pistachios, one lemon, don’t skip the pasta water
            </Text>
            <Text
              className="pt-3 text-[11px]"
              tone="muted"
              style={{ fontFamily: fonts.mono500 }}
            >
              {String(url) || 'instagram.com/reel/C8xk2Rp9Lm/'}
            </Text>
          </View>
        </View>
        <Text variant="caption" className="py-5 text-[13.5px] leading-[1.5]">
          {`We'll read the caption, the on-screen text and the spoken steps, then hand you a recipe to check.`}
        </Text>
        <Button
          label="Turn into a recipe"
          size="lg"
          onPress={() => {
            start().catch(() => undefined);
          }}
        />
        <Button
          label="Pick a different source"
          variant="ghost"
          onPress={() => router.back()}
        />
      </ScrollView>
    </Screen>
  );
}
