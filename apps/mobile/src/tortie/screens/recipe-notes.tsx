import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  View,
  type NativeSyntheticEvent,
  type TextInput,
  type TextInputKeyPressEventData,
} from 'react-native';

import { isMigratableRecipeId } from '@/features/kitchen/ids';
import {
  clearNoteDraft,
  readNoteDraft,
  writeNoteDraft,
} from '@/features/recipes/note-drafts';
import { useDeferredSecondary } from '@/features/recipes/hooks/use-deferred-secondary';
import { useRecipeNotes } from '@/features/recipes/hooks/use-recipe-notes';
import type { RecipeNoteDto } from '@/features/recipes/schemas';
import { useTRecipe } from '@/tortie/data/recipes';
import {
  effectiveStep,
  GENERAL,
  NOTE_CLAMP_LINES,
  notePreview,
  orderNotes,
  relativeDay,
  sameTarget,
  stepTarget,
  targetStepIndex,
  type NoteTarget,
} from '@/tortie/data/recipe-notes';
import { useFrame } from '@/tortie/frame';
import { toast, useNav } from '@/tortie/nav-store';
import { C, CSS_EASE, F } from '@/tortie/theme';
import { Grabber, Pill, SheetClose } from '@/tortie/ui/controls';
import { Glyph } from '@/tortie/ui/icon';
import { Input, RevealBox } from '@/tortie/ui/input';
import { Press } from '@/tortie/ui/press';
import { Sheet } from '@/tortie/ui/sheet';
import { em, sans, serif, T } from '@/tortie/ui/text';

const EMPTY: RecipeNoteDto[] = [];

/**
 * Notes for one recipe. Only recipes that exist on the server can carry notes; the lookup
 * waits for the first paint like the rest of the detail's secondary work.
 */
export function useNotesFor(id: string | null | undefined) {
  const syncable = !!id && isMigratableRecipeId(id);
  const ready = useDeferredSecondary(syncable);
  const api = useRecipeNotes(syncable ? id : undefined, ready);
  return {
    /** False for recipes that aren't saved to the account (no notes row, no step blocks). */
    syncable,
    notes: api.query.data ?? EMPTY,
    api,
  };
}

/* ───────────────────────────── Notes row (recipe page) ───────────────────────────── */

/** Icon tile, "Notes" with a count badge, a one-line preview and a trailing chevron or add. */
export function NotesRow({
  notes,
  onPress,
}: {
  notes: readonly RecipeNoteDto[];
  onPress: () => void;
}) {
  const count = notes.length;
  const preview = notePreview(notes);
  return (
    <Press
      onPress={onPress}
      scale={0.98}
      easing={CSS_EASE}
      accessibilityRole="button"
      accessibilityLabel={
        count ? `Notes, ${count}. Open notes` : 'Notes. Add a note'
      }
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 16,
        paddingVertical: 12,
        paddingHorizontal: 14,
        backgroundColor: C.surface2,
        borderRadius: 16,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: C.terraSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Glyph name="notes" size={22} color={C.terra} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <T style={sans(15, 700, C.ink)}>Notes</T>
          {count ? (
            <View
              style={{
                minWidth: 20,
                height: 20,
                paddingHorizontal: 6,
                borderRadius: 10,
                backgroundColor: C.green,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <T style={sans(11, 700, C.bg, { lineHeight: 14 })}>
                {String(count)}
              </T>
            </View>
          ) : null}
        </View>
        <T
          numberOfLines={1}
          style={sans(13, 400, preview ? C.ink2 : C.ink3, { marginTop: 2 })}
        >
          {preview || 'Add tweaks, swaps and reminders'}
        </T>
      </View>
      <Glyph name={count ? 'chevron_right' : 'add'} size={22} color={C.ink3} />
    </Press>
  );
}

/* ─────────────────────── Step / intro notes block ─────────────────────── */

/**
 * Collapsible notes under a step (or the cook-mode intro). Shows the newest note
 * clamped to two lines; "Show all n" opens the full list. "Add" opens the notes sheet.
 */
export function StepNotes({
  notes,
  onAdd,
  label,
  large = false,
}: {
  /** Notes for this step (or the general notes), any order. */
  notes: readonly RecipeNoteDto[];
  onAdd: () => void;
  label?: string;
  /** Cook mode sizing. */
  large?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);
  const ordered = useMemo(() => orderNotes(notes), [notes]);
  const body = sans(large ? 17 : 14, 400, C.ink, {
    lineHeight: large ? 25.5 : 20.3,
  });
  const link = sans(large ? 14 : 12, 700, C.green);

  if (!ordered.length) {
    return (
      <Press
        onPress={onAdd}
        scale={0.96}
        easing={CSS_EASE}
        accessibilityLabel="Add note"
        style={{
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          marginTop: large ? 20 : 10,
          paddingVertical: 4,
        }}
      >
        <Glyph name="add" size={large ? 18 : 16} color={C.green} />
        <T style={link}>Add note</T>
      </Press>
    );
  }

  const canToggle = ordered.length > 1 || clipped;
  return (
    <View
      style={{
        marginTop: large ? 20 : 10,
        padding: large ? 16 : 12,
        backgroundColor: C.terraWash,
        borderRadius: large ? 18 : 12,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Glyph name="notes" size={large ? 18 : 15} color={C.terra} />
        <T
          style={sans(large ? 12 : 11, 700, C.terra, {
            letterSpacing: em(11, 0.06),
            textTransform: 'uppercase',
          })}
        >
          {label ?? 'Your notes'}
        </T>
      </View>
      {open ? (
        ordered.map((n) => (
          <View key={n.id}>
            <T style={sans(11, 600, C.ink3, { marginBottom: 2 })}>
              {relativeDay(n.createdAt)}
            </T>
            <T style={body}>{n.body}</T>
          </View>
        ))
      ) : (
        <T
          numberOfLines={NOTE_CLAMP_LINES}
          onTextLayout={(e) =>
            setClipped(e.nativeEvent.lines.length > NOTE_CLAMP_LINES)
          }
          style={body}
        >
          {ordered[0]!.body}
        </T>
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {canToggle ? (
          <Press
            onPress={() => setOpen((v) => !v)}
            scale={0.96}
            easing={CSS_EASE}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
          >
            <T style={link}>
              {open
                ? 'Show less'
                : ordered.length > 1
                  ? `Show all ${ordered.length}`
                  : 'Show more'}
            </T>
          </Press>
        ) : (
          <View />
        )}
        <Press
          onPress={onAdd}
          scale={0.96}
          easing={CSS_EASE}
          hitSlop={8}
          accessibilityLabel="Add note"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
        >
          <Glyph name="add" size={large ? 18 : 16} color={C.green} />
          <T style={link}>Add</T>
        </Press>
      </View>
    </View>
  );
}

/* ───────────────────────────── Recipe notes sheet ───────────────────────────── */

type WebKeyEvent = TextInputKeyPressEventData & { shiftKey?: boolean };

export function RecipeNotesSheet() {
  const f = useFrame();
  const open = useNav((s) => s.notesOn);
  const id = useNav((s) => s.notesId);
  const presetStep = useNav((s) => s.notesStep);
  const over = useNav((s) => s.notesOverCook);
  const nonce = useNav((s) => s.notesNonce);
  const { r } = useTRecipe(id);
  const { syncable, notes, api } = useNotesFor(id);
  const stepCount = r?.steps.length ?? 0;

  const [text, setText] = useState('');
  const [target, setTarget] = useState<NoteTarget>(GENERAL);
  const [editing, setEditing] = useState<RecipeNoteDto | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const stash = useRef('');
  const draftReady = useRef(false);
  const inputRef = useRef<TextInput>(null);
  const busy = api.create.isPending || api.update.isPending;
  const ordered = useMemo(() => orderNotes(notes), [notes]);

  const [seen, setSeen] = useState(nonce);
  if (nonce !== seen) {
    setSeen(nonce);
    setTarget(
      presetStep != null && presetStep < stepCount
        ? stepTarget(presetStep)
        : GENERAL,
    );
    setEditing(null);
    setConfirmId(null);
    setText('');
  }

  // Restore the unsent draft for this recipe each time the sheet opens. Declared before the
  // persist effect so `draftReady` is cleared before that one runs.
  useEffect(() => {
    if (!open || !id) return;
    stash.current = '';
    draftReady.current = false;
    let live = true;
    readNoteDraft(id).then((draft) => {
      if (!live) return;
      draftReady.current = true;
      setText((cur) => cur || draft);
    });
    return () => {
      live = false;
    };
  }, [open, id, nonce]);

  // Focus the composer once the sheet has slid in.
  useEffect(() => {
    if (!open || !syncable) return;
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, [open, syncable, nonce]);

  // Persist the draft while typing a new note (not while editing one).
  useEffect(() => {
    if (!open || !id || editing || !draftReady.current) return;
    const t = setTimeout(() => void writeNoteDraft(id, text), 400);
    return () => clearTimeout(t);
  }, [text, open, id, editing]);

  const close = () => {
    inputRef.current?.blur();
    useNav.getState().closeNotes();
  };

  const finishEdit = () => {
    setEditing(null);
    setText(stash.current);
    stash.current = '';
  };

  const startEdit = (n: RecipeNoteDto) => {
    if (!editing) stash.current = text;
    setConfirmId(null);
    setEditing(n);
    const si = effectiveStep(n, stepCount);
    setTarget(si == null ? GENERAL : stepTarget(si));
    setText(n.body);
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  const submit = async () => {
    const body = text.trim();
    if (!body || busy || !id) return;
    const stepIndex = targetStepIndex(target);
    try {
      if (editing) {
        await api.update.mutateAsync({ noteId: editing.id, body, stepIndex });
        finishEdit();
        toast('Note updated');
      } else {
        await api.create.mutateAsync({ body, stepIndex });
        setText('');
        void clearNoteDraft(id);
        toast('Note added');
      }
    } catch {
      toast('Couldn’t save that note. Try again.', 'error');
    }
  };

  const remove = async (n: RecipeNoteDto) => {
    setConfirmId(null);
    if (editing?.id === n.id) finishEdit();
    try {
      await api.remove.mutateAsync({ noteId: n.id, confirmed: true });
      toast('Note deleted');
    } catch {
      toast('Couldn’t delete that note. Try again.', 'error');
    }
  };

  // Web: Enter sends, Shift+Enter breaks the line. Touch keyboards keep Enter as a line break.
  const onKeyPress = (e: NativeSyntheticEvent<WebKeyEvent>) => {
    if (Platform.OS !== 'web') return;
    const k = e.nativeEvent;
    if (k.key === 'Enter' && !k.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const has = text.trim().length > 0;
  const count = notes.length;

  const composer = (
    <View
      style={{
        marginTop: 10,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: C.line,
      }}
    >
      {editing ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Glyph name="edit" size={16} color={C.terra} />
            <T style={sans(13, 700, C.terra)}>Editing note</T>
          </View>
          <Press
            onPress={finishEdit}
            scale={0.96}
            hitSlop={8}
            accessibilityLabel="Cancel editing"
          >
            <T style={sans(13, 700, C.ink2)}>Cancel</T>
          </Press>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        style={{ flexGrow: 0, marginTop: editing ? 10 : 0 }}
        contentContainerStyle={{ gap: 8 }}
      >
        <Pill
          label="General"
          on={sameTarget(target, GENERAL)}
          height={34}
          size={13}
          onPress={() => setTarget(GENERAL)}
        />
        {Array.from({ length: stepCount }, (_, i) => (
          <Pill
            key={i}
            label={`Step ${i + 1}`}
            on={sameTarget(target, stepTarget(i))}
            height={34}
            size={13}
            onPress={() => setTarget(stepTarget(i))}
          />
        ))}
      </ScrollView>

      <RevealBox
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 8,
          marginTop: 12,
          paddingLeft: 16,
          paddingRight: 6,
          paddingVertical: 6,
          backgroundColor: C.surface2,
          borderWidth: 1.5,
          borderColor: has ? C.green : C.line,
          borderRadius: 24,
        }}
      >
        <Input
          ref={inputRef}
          value={text}
          onChangeText={setText}
          onKeyPress={onKeyPress}
          multiline
          maxLength={4000}
          placeholder={
            target.kind === 'step'
              ? `A note for step ${target.index + 1}…`
              : 'A note for this recipe…'
          }
          placeholderTextColor={C.ink3}
          allowFontScaling={false}
          textAlignVertical="center"
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 40,
            maxHeight: 120,
            // (40 − 21) / 2 centres one line against the 40px send button; iOS ignores
            // textAlignVertical, so the padding does the work there.
            paddingVertical: 9.5,
            paddingHorizontal: 0,
            includeFontPadding: false,
            fontFamily: F.sans400,
            fontSize: 15,
            lineHeight: 21,
            color: C.ink,
          }}
        />
        <Press
          onPress={() => void submit()}
          disabled={!has || busy}
          scale={0.9}
          easing={CSS_EASE}
          accessibilityLabel={editing ? 'Save note' : 'Add note'}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: has ? C.green : C.surface3,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Glyph
            name={editing ? 'check' : 'send'}
            size={20}
            color={has ? C.bg : C.ink3}
          />
        </Press>
      </RevealBox>
    </View>
  );

  return (
    <Sheet
      open={open}
      onClose={close}
      z={over ? 51 : 40}
      maxHeight={0.86}
      avoidKeyboard
      footer={syncable ? composer : undefined}
      style={{ paddingBottom: Math.max(28, f.sheetBottom) }}
    >
      <Grabber />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T style={serif(26, 500, C.ink, { letterSpacing: em(26, -0.01) })}>
            Notes
          </T>
          <T numberOfLines={1} style={sans(13, 400, C.ink2, { marginTop: 2 })}>
            {r?.title ?? ''}
            {count ? ` · ${count} ${count === 1 ? 'note' : 'notes'}` : ''}
          </T>
        </View>
        <SheetClose onPress={close} />
      </View>

      {!syncable ? (
        <T style={sans(14, 400, C.ink2, { marginTop: 24, lineHeight: 21 })}>
          Notes are available once this recipe is saved to your account.
        </T>
      ) : (
        <>
          <View style={{ marginTop: 14 }}>
            {ordered.length ? (
              ordered.map((n) => (
                <NoteItem
                  key={n.id}
                  note={n}
                  step={effectiveStep(n, stepCount)}
                  editing={editing?.id === n.id}
                  confirming={confirmId === n.id}
                  onEdit={() => startEdit(n)}
                  onAskDelete={() => setConfirmId(n.id)}
                  onCancelDelete={() => setConfirmId(null)}
                  onDelete={() => void remove(n)}
                />
              ))
            ) : (
              <NotesEmpty />
            )}
          </View>
        </>
      )}
    </Sheet>
  );
}

/** Left-aligned empty row: icon beside the text, no card, so the composer above stays in view. */
export function NotesEmpty() {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        paddingVertical: 12,
      }}
    >
      <View style={{ height: 21, justifyContent: 'center' }}>
        <Glyph name={NOTES_EMPTY_ICON} size={24} color={C.green} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T style={sans(15, 600, C.ink, { lineHeight: 21 })}>No notes yet</T>
        <T style={sans(13, 400, C.ink2, { lineHeight: 19, marginTop: 2 })}>
          Jot down tweaks, swaps or what the table said. They’ll be here next
          time you cook it.
        </T>
      </View>
    </View>
  );
}

/** Must exist in the bundled icon font. */
export const NOTES_EMPTY_ICON = 'edit';

function NoteItem({
  note,
  step,
  editing,
  confirming,
  onEdit,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  note: RecipeNoteDto;
  step: number | null;
  editing: boolean;
  confirming: boolean;
  onEdit: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  return (
    <View
      style={{
        paddingVertical: 14,
        borderTopWidth: 1,
        borderTopColor: C.line,
        opacity: editing ? 0.5 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <T style={sans(12, 600, C.ink3)}>{relativeDay(note.createdAt)}</T>
        {step != null ? (
          <View
            style={{
              backgroundColor: C.terraSoft,
              paddingVertical: 2,
              paddingHorizontal: 8,
              borderRadius: 99,
            }}
          >
            <T style={sans(11, 700, C.terraInk)}>{`Step ${step + 1}`}</T>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        {!confirming ? (
          <>
            <IconBtn icon="edit" label="Edit note" onPress={onEdit} />
            <IconBtn icon="delete" label="Delete note" onPress={onAskDelete} />
          </>
        ) : null}
      </View>
      <T style={sans(15, 400, C.ink, { lineHeight: 22.5, marginTop: 6 })}>
        {note.body}
      </T>
      {confirming ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginTop: 10,
          }}
        >
          <T style={sans(13, 600, C.ink2, { flex: 1 })}>Delete this note?</T>
          <Press
            onPress={onCancelDelete}
            scale={0.95}
            style={{
              height: 34,
              paddingHorizontal: 14,
              borderRadius: 99,
              backgroundColor: C.surface3,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T style={sans(13, 700, C.ink)}>Keep</T>
          </Press>
          <Press
            onPress={onDelete}
            scale={0.95}
            style={{
              height: 34,
              paddingHorizontal: 14,
              borderRadius: 99,
              backgroundColor: C.terra,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T style={sans(13, 700, C.bg)}>Delete</T>
          </Press>
        </View>
      ) : null}
    </View>
  );
}

function IconBtn({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Press
      onPress={onPress}
      scale={0.88}
      accessibilityLabel={label}
      hitSlop={6}
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Glyph name={icon} size={18} color={C.ink2} />
    </Press>
  );
}
