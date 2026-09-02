import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { SourceGrid } from '@/components/capture/source-grid';
import { SourceIcon } from '@/components/icons/source-icon';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import {
  inspectClipboard,
  SUPPORTED_CAPTURE_METHODS,
  SUPPORTED_PLATFORMS,
  type CaptureSource,
  type ClipboardOffer,
} from '@/features/capture/sources';
import { useUiStore } from '@/stores/ui-store';
import { colors, typeface } from '@/theme/tokens';

const HIDDEN_CLIPBOARD: ClipboardOffer = { kind: 'hidden' };

export function CaptureSheet() {
  const open = useUiStore((state) => state.captureOpen);
  const close = useUiStore((state) => state.closeCapture);
  const [clipboard, setClipboard] = useState<ClipboardOffer>(HIDDEN_CLIPBOARD);

  useEffect(() => {
    if (!open) {
      setClipboard(HIDDEN_CLIPBOARD);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const hasString =
          typeof Clipboard.hasStringAsync === 'function'
            ? await Clipboard.hasStringAsync()
            : true;
        const value = hasString ? await Clipboard.getStringAsync() : '';
        if (!cancelled) {
          setClipboard(inspectClipboard(value));
        }
      } catch {
        if (!cancelled) {
          setClipboard(HIDDEN_CLIPBOARD);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const go = (source: CaptureSource, url?: string, paste?: string) => {
    close();
    if (source === 'Photo' || source === 'Text' || source === 'Voice note') {
      router.push({
        pathname: '/import/manual',
        params: paste ? { paste } : {},
      });
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

  const useClipboard = () => {
    if (clipboard.kind === 'url') {
      go(clipboard.source, clipboard.url);
      return;
    }
    if (clipboard.kind === 'text') {
      go(clipboard.source, undefined, clipboard.text);
    }
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
      <SourceGrid sources={SUPPORTED_PLATFORMS} onSelect={go} />
      <View className="mt-2.5">
        <SourceGrid sources={SUPPORTED_CAPTURE_METHODS} onSelect={go} />
      </View>
      {clipboard.kind !== 'hidden' ? (
        <View className="mt-3 flex-row items-center gap-[11px] rounded-[17px] border border-crust bg-peach p-[15px]">
          <SourceIcon source={clipboard.source} size={28} />
          <View className="min-w-0 flex-1">
            <Text className="text-[13px]" tone="muted">
              Clipboard
            </Text>
            <Text
              numberOfLines={1}
              className="text-[11.5px]"
              tone="muted"
              style={typeface('regular')}
            >
              {clipboard.preview}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use clipboard"
            onPress={useClipboard}
            className="h-[38px] min-h-11 justify-center rounded-[12px] px-[15px]"
            style={{ backgroundColor: colors.espresso }}
          >
            <Text
              className="text-[12.5px]"
              tone="inverse"
              style={typeface('semibold')}
            >
              Use
            </Text>
          </Pressable>
        </View>
      ) : null}
    </Sheet>
  );
}
