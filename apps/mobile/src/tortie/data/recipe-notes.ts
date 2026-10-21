import type { RecipeNoteDto } from '@/features/recipes/schemas';
import { localizedMonths, tNow } from '@/i18n/format';

/** Where a note is attached: the whole recipe, or one step (zero-based). */
export type NoteTarget = { kind: 'general' } | { kind: 'step'; index: number };

export const GENERAL: NoteTarget = { kind: 'general' };

export function stepTarget(index: number): NoteTarget {
  return { kind: 'step', index };
}

export function targetStepIndex(target: NoteTarget): number | null {
  return target.kind === 'step' ? target.index : null;
}

export function sameTarget(a: NoteTarget, b: NoteTarget): boolean {
  return a.kind === b.kind && targetStepIndex(a) === targetStepIndex(b);
}

/** Newest first. Ties keep their incoming order. */
export function orderNotes(notes: readonly RecipeNoteDto[]): RecipeNoteDto[] {
  return notes
    .map((note, i) => ({ note, i, at: Date.parse(note.createdAt) || 0 }))
    .sort((a, b) => b.at - a.at || a.i - b.i)
    .map((x) => x.note);
}

/** Notes that belong to no step. */
export function generalNotes(notes: readonly RecipeNoteDto[]): RecipeNoteDto[] {
  return orderNotes(notes.filter((n) => n.stepIndex == null));
}

/** Notes on one step, newest first. */
export function stepNotes(
  notes: readonly RecipeNoteDto[],
  index: number,
): RecipeNoteDto[] {
  return orderNotes(notes.filter((n) => n.stepIndex === index));
}

/**
 * A note whose step no longer exists (the method got shorter) is shown as a general note
 * rather than hidden.
 */
export function effectiveStep(
  note: Pick<RecipeNoteDto, 'stepIndex'>,
  stepCount: number,
): number | null {
  const i = note.stepIndex;
  return i != null && i >= 0 && i < stepCount ? i : null;
}

/** "Today", "Yesterday", "3 days ago", then a short date for anything over a week. */
export function relativeDay(iso: string, now: number = Date.now()): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const today = new Date(now);
  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(today) - startOf(at)) / 86_400_000);
  if (days <= 0) return tNow('common.today');
  if (days === 1) return tNow('common.yesterday');
  if (days < 7) return tNow('time.daysAgo', { n: days });
  const month = localizedMonths[at.getMonth()] ?? '';
  const sameYear = at.getFullYear() === today.getFullYear();
  return sameYear
    ? `${month} ${at.getDate()}`
    : `${month} ${at.getDate()}, ${at.getFullYear()}`;
}

/** One-line preview for the Notes row: the newest note, flattened to a single line. */
export function notePreview(notes: readonly RecipeNoteDto[]): string {
  const newest = orderNotes(notes)[0];
  return newest ? newest.body.replace(/\s+/g, ' ').trim() : '';
}

/** Lines shown before a step's note block collapses behind "Show all". */
export const NOTE_CLAMP_LINES = 2;
