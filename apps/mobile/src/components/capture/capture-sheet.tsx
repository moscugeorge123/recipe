import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { SourceIcon } from '@/components/icons/source-icon';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { useUiStore } from '@/stores/ui-store';
import { colors, fonts } from '@/theme/tokens';

const SOURCES = [
  'Instagram',
  'TikTok',
  'YouTube',
  'Facebook',
  'Website',
  'Photo',
  'Text',
  'Voice note',
  'Share sheet',
] as const;

function detectSource(url: string): string {
  const value = url.toLowerCase();
  if (value.includes('instagram')) {
    return 'Instagram';
  }
  if (value.includes('youtu')) {
    return 'YouTube';
  }
  if (value.includes('tiktok')) {
    return 'TikTok';
  }
  if (value.includes('facebook')) {
    return 'Facebook';
  }
  return 'Website';
}

function looksLikeUrl(value: string): boolean {
  return (
    /^https?:\/\//i.test(value.trim()) || /\.[a-z]{2,}/i.test(value.trim())
  );
}

export function CaptureSheet() {
  const open = useUiStore((state) => state.captureOpen);
  const close = useUiStore((state) => state.closeCapture);
  const [clip, setClip] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    Clipboard.getStringAsync()
      .then((value) => setClip(value.trim()))
      .catch(() => setClip(''));
  }, [open]);

  const go = (source: string, url?: string) => {
    close();
    if (source === 'Facebook' || source === 'TikTok') {
      router.push({
        pathname: '/import/error',
        params: { code: 'UNSUPPORTED_SOURCE', source },
      });
      return;
    }
    if (source === 'Photo' || source === 'Text' || source === 'Voice note') {
      router.push('/import/manual');
      return;
    }
    router.push({
      pathname: '/import/preview',
      params: {
        source,
        url: url ?? '',
      },
    });
  };

  return (
    <Sheet visible={open} onClose={close} accessibilityLabel="Capture a recipe">
      <Text variant="title">Send me anything.</Text>
      <Text
        variant="caption"
        className="pb-[18px] pt-2 text-[13.5px] leading-[1.45]"
      >
        A link, a screenshot, a voice note from your mum. It comes back as a
        recipe.
      </Text>
      <View className="flex-row flex-wrap gap-2.5">
        {SOURCES.map((source) => (
          <Pressable
            key={source}
            accessibilityRole="button"
            accessibilityLabel={source}
            onPress={() => go(source)}
            className="h-[92px] w-[31%] items-center justify-center gap-2 rounded-[18px] border border-crust bg-bg-elevated"
          >
            <SourceIcon source={source} size={32} />
            <Text className="text-center text-[12px]" tone="icon">
              {source}
            </Text>
          </Pressable>
        ))}
      </View>
      <View className="mt-3 flex-row items-center gap-[11px] rounded-[17px] border border-crust bg-peach p-[15px]">
        <Text className="text-[13px]" tone="muted">
          Clipboard
        </Text>
        <Text
          numberOfLines={1}
          className="flex-1 text-[11.5px]"
          tone="muted"
          style={{ fontFamily: fonts.mono500 }}
        >
          {clip || 'instagram.com/reel/C8xk2… pistachio pasta'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use clipboard"
          onPress={() => {
            const value = clip || 'https://instagram.com/reel/C8xk2Rp9Lm/';
            const source = looksLikeUrl(value)
              ? detectSource(value)
              : 'Instagram';
            go(
              source,
              looksLikeUrl(value)
                ? value
                : 'https://instagram.com/reel/C8xk2Rp9Lm/',
            );
          }}
          className="h-[38px] min-h-11 justify-center rounded-[12px] px-[15px]"
          style={{ backgroundColor: colors.espresso }}
        >
          <Text
            className="text-[12.5px]"
            tone="inverse"
            style={{ fontFamily: fonts.manrope700 }}
          >
            Use
          </Text>
        </Pressable>
      </View>
    </Sheet>
  );
}
