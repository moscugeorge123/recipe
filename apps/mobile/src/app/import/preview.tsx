import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { ChevronLeft } from '@/components/icons/chevron-left';
import { SourceIcon } from '@/components/icons/source-icon';
import { Button } from '@/components/ui/button';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { IconButton } from '@/components/ui/icon-button';
import { InlineErrorPanel } from '@/components/ui/inline-error';
import { Input } from '@/components/ui/input';
import { PhotoStandIn } from '@/components/ui/photo-stand-in';
import { PressScale } from '@/components/ui/press-scale';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { inspectClipboard } from '@/features/capture/sources';
import { useCreateExtraction } from '@/features/extraction/hooks/use-create-extraction';
import { useLinkPreview } from '@/features/link-preview/hooks/use-link-preview';
import { SEED_RECIPES } from '@/features/recipes/seed';
import { mapUserError } from '@/lib/user-error';
import { useUiStore } from '@/stores/ui-store';
import { colors, fonts } from '@/theme/tokens';

function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

function formatAuthor(author: string): string {
  return author.startsWith('@') ? author : `@${author}`;
}

export default function ImportPreviewScreen() {
  const { source = 'Instagram', url = '' } = useLocalSearchParams<{
    source?: string;
    url?: string;
  }>();
  const paramUrl = String(url).trim();
  const [pastedUrl, setPastedUrl] = useState('');
  const [pickedThumbnailUrl, setPickedThumbnailUrl] = useState<string | null>(
    null,
  );

  const draftUrl = paramUrl || pastedUrl.trim();
  const preview = useLinkPreview(draftUrl);
  const create = useCreateExtraction();
  const showToast = useUiStore((state) => state.showToast);
  const pistachio = SEED_RECIPES[0];
  const placeholder = pistachio?.placeholder ?? ['#E6D9C4', '#DCCBB0'];

  const detected = inspectClipboard(draftUrl);
  const sourceLabel =
    detected.kind === 'url' ? detected.source : String(source);
  const hasUrl = /^https?:\/\//i.test(draftUrl);
  const thumbnails = preview.data?.thumbnails ?? [];
  const selectedThumbnailUrl =
    pickedThumbnailUrl &&
    thumbnails.some((thumb) => thumb.url === pickedThumbnailUrl)
      ? pickedThumbnailUrl
      : (thumbnails[0]?.url ?? null);

  useEffect(() => {
    if (preview.isError) {
      showToast({ text: "Couldn't load a preview", glyph: '!' });
    }
  }, [preview.isError, showToast]);

  const start = async () => {
    if (!hasUrl) {
      return;
    }
    try {
      const result = await create.mutateAsync({
        url: draftUrl,
        ...(selectedThumbnailUrl ? { selectedThumbnailUrl } : {}),
      });
      router.replace({
        pathname: '/import/extract/[jobId]',
        params: {
          jobId: result.jobId,
          url: draftUrl,
          ...(selectedThumbnailUrl
            ? { thumbnailUrl: selectedThumbnailUrl }
            : {}),
        },
      });
    } catch (error) {
      const mapped = mapUserError(error, 'import');
      router.push({
        pathname: '/import/error',
        params: {
          code: mapped.code ?? 'EXTRACTION_FAILED',
          source: sourceLabel,
        },
      });
      showToast({ text: mapped.title, glyph: '!' });
    }
  };

  const previewCopy = preview.isError
    ? mapUserError(preview.error ?? new Error('offline'), 'preview', {
        log: !!preview.error,
      })
    : undefined;
  const authorLabel = preview.data?.author?.trim()
    ? formatAuthor(preview.data.author.trim())
    : null;
  const titleLabel = preview.data?.title?.trim() || null;

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="px-5 pb-10"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-between pb-2 pt-1">
          <IconButton
            accessibilityLabel="Back"
            onPress={() => router.back()}
            className="-ml-[11px]"
          >
            <ChevronLeft />
          </IconButton>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 22,
              color: colors.paprika,
            }}
          >
            Recipe
          </Text>
          <View className="w-11" />
        </View>
        <View className="flex-row items-center gap-1.5 pb-5">
          <SourceIcon source={sourceLabel} size={22} />
          <Text className="text-[15px]">Importing from {sourceLabel}</Text>
        </View>
        {!paramUrl ? (
          <View className="mb-4">
            <Input
              label="URL"
              value={pastedUrl}
              onChangeText={setPastedUrl}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="https://"
            />
          </View>
        ) : null}
        {hasUrl ? (
          <View className="overflow-hidden rounded-[20px] border border-crust bg-bg-elevated">
            <PhotoStandIn
              uri={
                preview.isSuccess
                  ? (selectedThumbnailUrl ?? thumbnails[0]?.url)
                  : null
              }
              colors={placeholder}
              height={200}
              radius={0}
              label="video still"
            />
            <View className="p-4">
              {preview.isPending ? (
                <ContentSkeleton shape="preview" />
              ) : (
                <>
                  {authorLabel || titleLabel ? (
                    <View className="flex-row items-center gap-2.5 pb-[11px]">
                      <SourceIcon source={sourceLabel} size={28} />
                      <View className="min-w-0 flex-1">
                        {authorLabel ? (
                          <Text className="text-[13px]" tone="muted">
                            {authorLabel}
                          </Text>
                        ) : null}
                        {titleLabel ? (
                          <Text
                            className="text-[14.5px] leading-[1.35]"
                            tone="icon"
                            numberOfLines={1}
                          >
                            {titleLabel}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ) : null}
                  {previewCopy ? (
                    <View className="pt-2">
                      <InlineErrorPanel
                        message={previewCopy.message}
                        retryLabel={previewCopy.actionLabel}
                        retrying={preview.isFetching}
                        onRetry={() => {
                          void preview.refetch();
                        }}
                      />
                    </View>
                  ) : null}
                  <Text
                    className="pt-3 text-[11px]"
                    tone="muted"
                    style={{ fontFamily: fonts.mono500 }}
                  >
                    {displayUrl(draftUrl)}
                  </Text>
                </>
              )}
              {preview.isSuccess && thumbnails.length > 1 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="pt-3"
                >
                  {thumbnails.map((thumb, index) => {
                    const selected = thumb.url === selectedThumbnailUrl;
                    return (
                      <PressScale
                        key={thumb.url}
                        accessibilityRole="button"
                        accessibilityLabel={`Thumbnail ${index + 1}`}
                        accessibilityState={{ selected }}
                        onPress={() => setPickedThumbnailUrl(thumb.url)}
                        className="mr-2 overflow-hidden rounded-[10px]"
                        style={{
                          borderWidth: 2,
                          borderColor: selected ? colors.cta : colors.espresso,
                        }}
                      >
                        <View style={{ width: 72 }}>
                          <PhotoStandIn
                            uri={thumb.url}
                            colors={placeholder}
                            height={72}
                            radius={0}
                            label={`still ${index + 1}`}
                          />
                        </View>
                      </PressScale>
                    );
                  })}
                </ScrollView>
              ) : null}
            </View>
          </View>
        ) : null}
        <Button
          label={create.isPending ? 'Starting…' : 'Turn into a recipe'}
          size="lg"
          disabled={!hasUrl || create.isPending}
          onPress={() => {
            if (create.isPending) {
              return;
            }
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
