import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { ChevronLeft } from '@/components/icons/chevron-left';
import { SourceIcon } from '@/components/icons/source-icon';
import { IconButton } from '@/components/ui/icon-button';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import {
  inspectClipboard,
  type CaptureSource,
  type ClipboardOffer,
} from '@/features/capture/sources';
import { CollectionFormSheet } from '@/features/collections/collection-form-sheet';
import { useCreateCollection } from '@/features/collections/hooks';
import { announce } from '@/lib/announce';
import { isOfflineError } from '@/lib/network';
import { mapUserError } from '@/lib/user-error';
import { ApiError } from '@/services/api-client';
import { useKitchenStore } from '@/stores/kitchen-store';
import { useUiStore } from '@/stores/ui-store';
import { colors, fonts } from '@/theme/tokens';

const HIDDEN_CLIPBOARD: ClipboardOffer = { kind: 'hidden' };

type CaptureStep = 'chooser' | 'recipe';

const METHOD_TILES = [
  { label: 'Photo', source: 'Photo' as const, icon: 'Photo' },
  { label: 'Text', source: 'Text' as const, icon: 'Text' },
  { label: 'Web', source: 'Website' as const, icon: 'Website' },
  { label: 'Write from scratch', source: 'Text' as const, icon: 'Note' },
] as const;

export function CaptureSheet() {
  const open = useUiStore((state) => state.captureOpen);
  const close = useUiStore((state) => state.closeCapture);
  const addCollection = useKitchenStore((state) => state.addCollection);
  const create = useCreateCollection();
  const [step, setStep] = useState<CaptureStep>('chooser');
  const [clipboard, setClipboard] = useState<ClipboardOffer>(HIDDEN_CLIPBOARD);
  const [cookbookOpen, setCookbookOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      if (open) {
        setCookbookOpen(false);
        setStep('chooser');
        return;
      }
      setClipboard(HIDDEN_CLIPBOARD);
      setStep('chooser');
    });
  }, [open]);

  useEffect(() => {
    if (!open) {
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
    setStep('chooser');
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

  const closeCookbook = () => {
    if (create.isPending) {
      return;
    }
    setCookbookOpen(false);
    setFormError(null);
  };

  const submitCookbook = async (name: string) => {
    setFormError(null);
    try {
      try {
        const created = await create.mutateAsync({ name });
        announce(`${created.name} created`);
      } catch (error) {
        if (
          isOfflineError(error) &&
          !(error instanceof ApiError && error.status === 409)
        ) {
          addCollection(name);
          announce(`${name} saved on this device until you’re back online`);
        } else {
          throw error;
        }
      }
      setCookbookOpen(false);
    } catch (error) {
      setFormError(mapUserError(error, 'collections').message);
    }
  };

  return (
    <>
      <Sheet
        visible={open}
        onClose={() => {
          close();
          setStep('chooser');
        }}
        accessibilityLabel="Capture a recipe"
      >
        {step === 'chooser' ? (
          <ChooserStep
            onAddRecipe={() => setStep('recipe')}
            onAddCookbook={() => {
              setFormError(null);
              close();
              setCookbookOpen(true);
            }}
          />
        ) : (
          <RecipeStep onBack={() => setStep('chooser')} onSelect={go} />
        )}
        {clipboard.kind !== 'hidden' ? (
          <View className="mt-3 flex-row items-center gap-[11px] rounded-[17px] border border-crust bg-surface p-[15px]">
            <SourceIcon source={clipboard.source} size={28} />
            <View className="min-w-0 flex-1">
              <Text className="text-[13px]" tone="muted">
                Clipboard
              </Text>
              <Text
                numberOfLines={1}
                className="text-[11.5px]"
                tone="muted"
                style={{ fontFamily: fonts.mono500 }}
              >
                {clipboard.preview}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Use clipboard"
              onPress={useClipboard}
              className="h-[38px] min-h-11 justify-center rounded-[12px] px-[15px]"
              style={{ backgroundColor: colors.cta }}
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
        ) : null}
      </Sheet>
      <CollectionFormSheet
        visible={cookbookOpen}
        title="New cookbook"
        submitLabel="Create"
        pending={create.isPending}
        error={formError}
        onClose={closeCookbook}
        onSubmit={(name) => {
          void submitCookbook(name);
        }}
      />
    </>
  );
}

function ChooserStep({
  onAddRecipe,
  onAddCookbook,
}: {
  onAddRecipe: () => void;
  onAddCookbook: () => void;
}) {
  return (
    <View>
      <ChooserRow
        label="Add a Recipe"
        caption="Import from anywhere"
        onPress={onAddRecipe}
      />
      <View className="h-px bg-crust" />
      <ChooserRow label="Add a Cookbook" onPress={onAddCookbook} />
    </View>
  );
}

function ChooserRow({
  label,
  caption,
  onPress,
}: {
  label: string;
  caption?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={caption}
      onPress={onPress}
      className="min-h-11 flex-row items-center py-3.5"
    >
      <View className="min-w-0 flex-1 pr-3">
        <Text
          className="text-[17px] leading-[1.25]"
          style={{ fontFamily: fonts.manrope700 }}
        >
          {label}
        </Text>
        {caption ? (
          <Text variant="caption" className="pt-0.5 text-[13px]">
            {caption}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={20} color={colors.olive} strokeWidth={2.2} />
    </Pressable>
  );
}

function RecipeStep({
  onBack,
  onSelect,
}: {
  onBack: () => void;
  onSelect: (source: CaptureSource) => void;
}) {
  return (
    <View>
      <View className="mb-3 flex-row items-center gap-1">
        <IconButton
          accessibilityLabel="Back"
          onPress={onBack}
          className="-ml-2"
        >
          <ChevronLeft />
        </IconButton>
        <Text variant="title">Add a Recipe</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Import from social media"
        onPress={() => onSelect('Instagram')}
        className="mb-2.5 min-h-[88px] flex-row items-center gap-3.5 rounded-[18px] border border-crust bg-bg-elevated px-4"
      >
        <View className="flex-row items-center gap-2">
          <SourceIcon source="Instagram" size={36} />
          <SourceIcon source="YouTube" size={36} />
        </View>
        <Text
          className="flex-1 text-[15px] leading-[1.3]"
          style={{ fontFamily: fonts.manrope700 }}
        >
          Import from social media
        </Text>
      </Pressable>
      <View className="flex-row flex-wrap justify-between gap-y-2.5">
        {METHOD_TILES.map((tile) => (
          <Pressable
            key={tile.label}
            accessibilityRole="button"
            accessibilityLabel={tile.label}
            onPress={() => onSelect(tile.source)}
            className="h-[92px] w-[48%] items-center justify-center gap-2 rounded-[18px] border border-crust bg-bg-elevated px-2"
          >
            <SourceIcon source={tile.icon} size={32} />
            <Text
              className="px-1 text-center text-[12px]"
              tone="icon"
              numberOfLines={2}
            >
              {tile.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
