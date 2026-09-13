import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import {
  useDeletePantryItem,
  useOrganizePantry,
  usePantryItems,
  usePatchPantryItem,
  useSavePantryItems,
} from '@/features/pantry/hooks';
import {
  clearPantryDraft,
  readPantryDraft,
  writePantryDraft,
} from '@/features/pantry/pantry-drafts';
import { PantryWorkspace } from '@/features/pantry/pantry-workspace';
import type {
  GroceryCategory,
  OrganizedPantryItem,
  PantryItemView,
  UnresolvedPantryLine,
} from '@/features/pantry/types';
import { mergeOrganizedItems } from '@/features/pantry/types';
import { useReducedMotion } from '@/lib/motion';
import { showUndoToast } from '@/lib/undo-toast';
import { mapUserError } from '@/lib/user-error';
import { useUiStore } from '@/stores/ui-store';

export function PantryPanel({ compact = false }: { compact?: boolean }) {
  const [draft, setDraft] = useState('');
  const [preview, setPreview] = useState<OrganizedPantryItem[]>([]);
  const [unresolved, setUnresolved] = useState<UnresolvedPantryLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [adding, setAdding] = useState(!compact);
  const [category, setCategory] = useState<GroceryCategory | 'All'>('All');
  const [organizeError, setOrganizeError] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const showToast = useUiStore((state) => state.showToast);
  const organize = useOrganizePantry();
  const save = useSavePantryItems();
  const patch = usePatchPantryItem();
  const remove = useDeletePantryItem();
  const recreate = useSavePantryItems();
  const pantry = usePantryItems(category === 'All' ? undefined : category);
  const saved = pantry.data?.items ?? [];
  const showComposer =
    !compact || adding || !!draft.trim() || preview.length > 0;

  useEffect(() => {
    let active = true;
    void readPantryDraft().then((stored) => {
      if (!active) {
        return;
      }
      setDraft(stored.text);
      setPreview(stored.preview);
      setUnresolved(stored.unresolved);
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    const handle = setTimeout(() => {
      void writePantryDraft({ text: draft, preview, unresolved });
    }, 200);
    return () => clearTimeout(handle);
  }, [draft, hydrated, preview, unresolved]);

  const retryText = useMemo(
    () =>
      unresolved
        .filter((item) => item.retryable)
        .map((item) => item.rawText)
        .join('\n'),
    [unresolved],
  );

  const runOrganize = async (text: string, merge: boolean): Promise<void> => {
    if (organize.isPending) {
      return;
    }
    setOrganizeError(null);
    try {
      const result = await organize.mutateAsync({ text });
      setPreview((current) =>
        merge ? mergeOrganizedItems(current, result) : result.items,
      );
      setUnresolved(result.unresolved);
      if (!result.meta.aiAvailable || result.unresolved.length) {
        showToast({
          text: result.meta.aiAvailable
            ? 'Sorted what I could — check the highlighted lines'
            : 'Sorted with the built-in list — retry anything that looks off',
          glyph: '·',
        });
      }
    } catch (error) {
      setOrganizeError(mapUserError(error, 'pantry').message);
    }
  };

  const undoDelete = (item: PantryItemView): void => {
    void recreate.mutateAsync([
      {
        name: item.name,
        canonicalName: item.canonicalName ?? item.name,
        category: item.category ?? 'Pantry',
        emoji: item.emoji ?? '🥣',
        colorToken: item.colorToken ?? 'peach',
        rawText: item.rawText ?? item.name,
        quantity: item.quantity,
        unit: item.unit,
      },
    ]);
  };

  return (
    <View>
      {compact && !showComposer ? (
        <Button
          label="Add to pantry"
          variant="ghost"
          className="mb-3 self-start px-0"
          onPress={() => setAdding(true)}
        />
      ) : null}
      <PantryWorkspace
        draftText={draft}
        onChangeDraft={setDraft}
        showComposer={showComposer}
        organizing={organize.isPending}
        onOrganize={() => {
          void runOrganize(draft, false);
        }}
        organizeError={organizeError}
        onRetryOrganize={() => {
          void runOrganize(draft, preview.length > 0);
        }}
        preview={preview}
        unresolved={unresolved}
        onChangePreviewItem={(index, itemPatch) => {
          setPreview((current) =>
            current.map((item, itemIndex) =>
              itemIndex === index ? { ...item, ...itemPatch } : item,
            ),
          );
        }}
        accepting={save.isPending}
        onAccept={() => {
          if (save.isPending) {
            return;
          }
          void save
            .mutateAsync(preview)
            .then(() => {
              setPreview([]);
              setUnresolved([]);
              setDraft('');
              setAdding(false);
              void clearPantryDraft();
              showToast({ text: 'Saved to your pantry', glyph: '✓' });
            })
            .catch((error: unknown) => {
              showToast({
                text: mapUserError(error, 'pantry').message,
                glyph: '!',
              });
            });
        }}
        retrying={organize.isPending && preview.length > 0}
        onRetryUnresolved={() => {
          if (!retryText) {
            return;
          }
          void runOrganize(retryText, true);
        }}
        saved={saved}
        savedLoading={pantry.isLoading}
        savedError={pantry.isError}
        savedFromCache={pantry.data?.fromCache === true}
        onRetrySaved={() => {
          void pantry.refetch();
        }}
        category={category}
        onChangeCategory={setCategory}
        onDeleteSaved={(id) => {
          const item = saved.find((entry) => entry.id === id);
          remove.mutate(id, {
            onSuccess: () => {
              if (item) {
                showUndoToast(`${item.name} removed`, () => undoDelete(item));
              }
            },
          });
        }}
        onRenameSaved={(id, name) => {
          patch.mutate({ id, body: { name } });
        }}
        reducedMotion={reduced}
      />
    </View>
  );
}
