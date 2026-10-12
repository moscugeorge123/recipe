import type { RecipeNoteDto } from '@/features/recipes/schemas';
import {
  effectiveStep,
  generalNotes,
  GENERAL,
  notePreview,
  orderNotes,
  relativeDay,
  sameTarget,
  stepNotes,
  stepTarget,
  targetStepIndex,
} from '@/tortie/data/recipe-notes';

function note(
  id: string,
  createdAt: string,
  stepIndex: number | null = null,
  body = id,
): RecipeNoteDto {
  return {
    id,
    recipeId: 'r1',
    body,
    cookSessionId: null,
    stepIndex,
    createdAt,
    updatedAt: createdAt,
  };
}

describe('orderNotes', () => {
  test('puts the newest note first and keeps ties in input order', () => {
    const out = orderNotes([
      note('old', '2026-10-01T10:00:00.000Z'),
      note('tie-a', '2026-10-05T10:00:00.000Z'),
      note('tie-b', '2026-10-05T10:00:00.000Z'),
      note('new', '2026-10-09T10:00:00.000Z'),
    ]);
    expect(out.map((n) => n.id)).toEqual(['new', 'tie-a', 'tie-b', 'old']);
  });

  test('does not mutate its input', () => {
    const input = [
      note('a', '2026-10-01T10:00:00.000Z'),
      note('b', '2026-10-02T10:00:00.000Z'),
    ];
    orderNotes(input);
    expect(input.map((n) => n.id)).toEqual(['a', 'b']);
  });
});

describe('general and step notes', () => {
  const all = [
    note('g1', '2026-10-01T10:00:00.000Z'),
    note('s0', '2026-10-02T10:00:00.000Z', 0),
    note('s2-old', '2026-10-03T10:00:00.000Z', 2),
    note('s2-new', '2026-10-04T10:00:00.000Z', 2),
    note('g2', '2026-10-05T10:00:00.000Z'),
  ];

  test('general notes exclude step notes', () => {
    expect(generalNotes(all).map((n) => n.id)).toEqual(['g2', 'g1']);
  });

  test('step notes are filtered by index, newest first', () => {
    expect(stepNotes(all, 2).map((n) => n.id)).toEqual(['s2-new', 's2-old']);
    expect(stepNotes(all, 1)).toEqual([]);
  });

  test('step 0 is a real step, not general', () => {
    expect(stepNotes(all, 0).map((n) => n.id)).toEqual(['s0']);
  });
});

describe('effectiveStep', () => {
  test('keeps a step that still exists', () => {
    expect(effectiveStep({ stepIndex: 2 }, 5)).toBe(2);
    expect(effectiveStep({ stepIndex: 0 }, 1)).toBe(0);
  });

  test('falls back to general when the step is gone or unset', () => {
    expect(effectiveStep({ stepIndex: 5 }, 5)).toBeNull();
    expect(effectiveStep({ stepIndex: null }, 5)).toBeNull();
  });
});

describe('targets', () => {
  test('compare by kind and index', () => {
    expect(sameTarget(GENERAL, GENERAL)).toBe(true);
    expect(sameTarget(stepTarget(1), stepTarget(1))).toBe(true);
    expect(sameTarget(stepTarget(1), stepTarget(2))).toBe(false);
    expect(sameTarget(stepTarget(0), GENERAL)).toBe(false);
  });

  test('map to the API step index', () => {
    expect(targetStepIndex(GENERAL)).toBeNull();
    expect(targetStepIndex(stepTarget(0))).toBe(0);
  });
});

describe('relativeDay', () => {
  const now = new Date(2026, 9, 12, 15, 0).getTime();
  const at = (d: number, h = 9) => new Date(2026, 9, d, h, 0).toISOString();

  test('labels today and yesterday', () => {
    expect(relativeDay(at(12, 1), now)).toBe('Today');
    expect(relativeDay(at(11, 23), now)).toBe('Yesterday');
  });

  test('counts days within a week', () => {
    expect(relativeDay(at(9), now)).toBe('3 days ago');
    expect(relativeDay(at(6), now)).toBe('6 days ago');
  });

  test('falls back to a short date', () => {
    expect(relativeDay(at(5), now)).toBe('Oct 5');
    expect(relativeDay(new Date(2025, 11, 24).toISOString(), now)).toBe(
      'Dec 24, 2025',
    );
  });

  test('treats a future or invalid date safely', () => {
    expect(relativeDay(at(14), now)).toBe('Today');
    expect(relativeDay('nope', now)).toBe('');
  });
});

describe('notePreview', () => {
  test('uses the newest note on one line', () => {
    expect(
      notePreview([
        note('a', '2026-10-01T10:00:00.000Z', null, 'older'),
        note('b', '2026-10-02T10:00:00.000Z', 1, 'less salt,\n  more lemon'),
      ]),
    ).toBe('less salt, more lemon');
  });

  test('is empty without notes', () => {
    expect(notePreview([])).toBe('');
  });
});
