import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/text-input';
import { InlineErrorPanel } from '@/components/ui/inline-error';
import { Text } from '@/components/ui/text';
import { useRecipeNotes } from '@/features/recipes/hooks/use-recipe-notes';
import {
  clearNoteDraft,
  readNoteDraft,
  writeNoteDraft,
} from '@/features/recipes/note-drafts';
import type { RecipeNoteDto } from '@/features/recipes/schemas';
import { showUndoToast } from '@/lib/undo-toast';
import { mapUserError } from '@/lib/user-error';
import { colors, fonts } from '@/theme/tokens';

function formatStamp(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function NoteCard({
  note,
  onSave,
  onDelete,
  busy,
}: {
  note: RecipeNoteDto;
  onSave: (body: string) => Promise<void>;
  onDelete: () => Promise<void>;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);

  return (
    <View className="mt-2 rounded-[16px] bg-linen p-4">
      <Text variant="caption">{formatStamp(note.updatedAt)}</Text>
      {note.cookSessionId ? (
        <Text variant="caption" className="pt-0.5">
          From a cook
        </Text>
      ) : null}
      {editing ? (
        <>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            accessibilityLabel="Edit note"
            className="min-h-[72px] pt-2"
            style={{
              color: colors.espresso,
              fontFamily: fonts.manrope500,
              fontSize: 15,
            }}
          />
          <View className="mt-2 flex-row gap-2">
            <Button
              label="Save"
              size="md"
              disabled={busy || !draft.trim()}
              onPress={() => {
                void onSave(draft.trim()).then(() => setEditing(false));
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel edit"
              className="min-h-11 justify-center px-3"
              onPress={() => {
                setDraft(note.body);
                setEditing(false);
              }}
            >
              <Text tone="muted">Cancel</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text className="pt-1.5">{note.body}</Text>
          <View className="mt-2 flex-row gap-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit note"
              className="min-h-11 justify-center"
              onPress={() => {
                setDraft(note.body);
                setEditing(true);
              }}
            >
              <Text tone="primary">Edit</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete note"
              className="min-h-11 justify-center"
              disabled={busy}
              onPress={() => {
                void onDelete();
              }}
            >
              <Text tone="muted">Delete</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

export function RecipeNotesPanel({
  recipeId,
  enabled,
  cookSessionId,
}: {
  recipeId: string;
  enabled: boolean;
  cookSessionId?: string | null;
}) {
  const notes = useRecipeNotes(recipeId, enabled);
  const [draft, setDraft] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewCount, setPreviewCount] = useState(4);

  useEffect(() => {
    let active = true;
    void readNoteDraft(recipeId).then((value) => {
      if (active) {
        setDraft(value);
        setHydrated(true);
      }
    });
    return () => {
      active = false;
    };
  }, [recipeId]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    const handle = setTimeout(() => {
      void writeNoteDraft(recipeId, draft);
    }, 200);
    return () => clearTimeout(handle);
  }, [draft, hydrated, recipeId]);

  const save = async () => {
    const body = draft.trim();
    if (!body) {
      return;
    }
    setError(null);
    try {
      await notes.create.mutateAsync({
        body,
        ...(cookSessionId ? { cookSessionId } : {}),
      });
      setDraft('');
      await clearNoteDraft(recipeId);
    } catch (error) {
      const mapped = mapUserError(error, 'notes');
      setError(
        mapped.code === 'RECIPE_NOTE_NOT_FOUND'
          ? mapped.message
          : 'Couldn’t save this note. It’s still here — try again.',
      );
    }
  };

  return (
    <View className="mt-6">
      <Text variant="section">NOTES</Text>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Use a little less salt, it already has parmesan…"
        placeholderTextColor={colors.olive}
        accessibilityLabel="New recipe note"
        multiline
        textAlignVertical="top"
        className="mt-3 min-h-[88px] rounded-[16px] p-4"
        style={{
          backgroundColor: colors.searchFill,
          color: colors.espresso,
          fontFamily: fonts.manrope500,
          fontSize: 15,
        }}
      />
      <View className="mt-3">
        <Button
          label="Save note"
          size="md"
          disabled={!draft.trim() || notes.create.isPending}
          onPress={() => {
            void save();
          }}
        />
      </View>
      {error ? (
        <View className="mt-2">
          <InlineErrorPanel
            message={error}
            retryLabel="Retry"
            retrying={notes.create.isPending}
            onRetry={() => {
              void save();
            }}
          />
        </View>
      ) : null}

      {notes.query.isError ? (
        <View className="mt-3">
          <InlineErrorPanel
            message="We couldn’t load your notes."
            retrying={notes.query.isFetching}
            onRetry={() => {
              void notes.query.refetch();
            }}
          />
        </View>
      ) : null}

      {(notes.query.data ?? []).slice(0, previewCount).map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          busy={notes.update.isPending || notes.remove.isPending}
          onSave={async (body) => {
            await notes.update.mutateAsync({ noteId: note.id, body });
          }}
          onDelete={async () => {
            const snapshot = note;
            await notes.remove.mutateAsync({
              noteId: note.id,
              confirmed: true,
            });
            showUndoToast('Note deleted', () => {
              void notes.create.mutateAsync({
                body: snapshot.body,
                ...(snapshot.cookSessionId
                  ? { cookSessionId: snapshot.cookSessionId }
                  : {}),
              });
            });
          }}
        />
      ))}
      {(notes.query.data?.length ?? 0) > previewCount ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Show all ${notes.query.data?.length ?? 0} notes`}
          onPress={() => setPreviewCount(notes.query.data?.length ?? 4)}
          className="mt-2 min-h-11 justify-center"
        >
          <Text tone="muted">Show all {notes.query.data?.length} notes</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
