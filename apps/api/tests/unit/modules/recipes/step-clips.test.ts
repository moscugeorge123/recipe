import { describe, expect, it } from 'vitest';

import {
  alignStepClips,
  clipTokens,
  heuristicStepClips,
  isSingleTimeline,
  normalizeClipRanges,
  parseClipRanges,
  transcriptDurationSeconds,
  type ClipSegment,
} from '../../../../src/modules/recipes/application/step-clips.js';

function seg(startSeconds: number, text: string, length = 4): ClipSegment {
  return { startSeconds, endSeconds: startSeconds + length, text };
}

const TRANSCRIPT: ClipSegment[] = [
  seg(0, 'Hey everyone, welcome back to my kitchen'),
  seg(4, 'Today we are making creamy mushroom pasta'),
  seg(9, 'First slice the mushrooms and chop some garlic'),
  seg(14, 'Fry the mushrooms in a hot pan with butter until golden'),
  seg(21, 'Now pour in the cream and let it simmer gently'),
  seg(28, 'Boil the pasta in salted water and drain it'),
  seg(36, 'Toss the pasta with the cream sauce and serve with parmesan'),
];

describe('clipTokens', () => {
  it('lowercases, drops stop words and short words, and stems plurals', () => {
    expect(clipTokens('Fry the Mushrooms, with butter!')).toEqual(['fry', 'mushroom', 'butter']);
  });

  it('folds accents', () => {
    expect(clipTokens('Crème fraîche')).toEqual(['creme', 'fraiche']);
  });
});

describe('isSingleTimeline / transcriptDurationSeconds', () => {
  it('accepts ordered segments and rejects merged timelines', () => {
    expect(isSingleTimeline(TRANSCRIPT)).toBe(true);
    expect(isSingleTimeline([seg(10, 'a b c'), seg(2, 'd e f')])).toBe(false);
    expect(isSingleTimeline([])).toBe(false);
  });

  it('rounds the last end up to a whole second', () => {
    expect(transcriptDurationSeconds([seg(0, 'x', 3.2), seg(3, 'y', 4.1)])).toBe(8);
    expect(transcriptDurationSeconds([])).toBeNull();
  });
});

describe('alignStepClips', () => {
  const steps = [
    { title: 'Slice the mushrooms', instruction: 'Slice the mushrooms and chop the garlic.' },
    { title: 'Fry the mushrooms', instruction: 'Fry the mushrooms in butter until golden.' },
    { title: 'Add the cream', instruction: 'Pour in the cream and simmer gently.' },
    { title: 'Boil the pasta', instruction: 'Boil the pasta in salted water, then drain.' },
    { title: 'Toss and serve', instruction: 'Toss the pasta with the cream sauce and serve with parmesan.' },
  ];

  it('places each step at the caption that first talks about it, in order', () => {
    expect(alignStepClips(steps, TRANSCRIPT)).toEqual([9, 14, 21, 28, 36]);
  });

  it('gives steps with no match no clip and keeps the rest', () => {
    const withGap = [
      steps[0]!,
      { title: 'Plate with flowers', instruction: 'Garnish with edible orchids and gold leaf.' },
      steps[3]!,
    ];
    expect(alignStepClips(withGap, TRANSCRIPT)).toEqual([9, null, 28]);
  });

  it('never gives ahead steps a clip', () => {
    const withAhead = [{ ...steps[3]!, ahead: true }, steps[0]!, steps[1]!];
    expect(alignStepClips(withAhead, TRANSCRIPT)).toEqual([null, 9, 14]);
  });

  it('does not reuse an earlier caption for a later step', () => {
    const repeated = [
      steps[0]!,
      steps[1]!,
      { title: 'Fry the mushrooms again', instruction: 'Fry the mushrooms in butter once more.' },
    ];
    expect(alignStepClips(repeated, TRANSCRIPT)).toEqual([9, 14, null]);
  });

  it('returns no clips when fewer than two steps line up', () => {
    expect(alignStepClips([steps[0]!, steps[1]!], [seg(0, 'Nothing relevant here at all')])).toEqual([
      null,
      null,
    ]);
    expect(alignStepClips([steps[0]!], TRANSCRIPT)).toEqual([null]);
  });

  it('returns no clips without a timeline', () => {
    expect(alignStepClips(steps, [])).toEqual([null, null, null, null, null]);
    expect(alignStepClips(steps, [seg(30, 'slice the mushrooms'), seg(5, 'fry the mushrooms')])).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
  });
});

describe('heuristicStepClips', () => {
  const steps = [
    { title: 'Slice the mushrooms', instruction: 'Slice the mushrooms and chop the garlic.' },
    { title: 'Fry the mushrooms', instruction: 'Fry the mushrooms in butter until golden.' },
    { title: 'Plate with flowers', instruction: 'Garnish with edible orchids and gold leaf.' },
    { title: 'Boil the pasta', instruction: 'Boil the pasta in salted water, then drain.' },
  ];

  it('runs each placed step until the next placed step, and the last to the video end', () => {
    expect(heuristicStepClips(steps, TRANSCRIPT, 50)).toEqual([
      [{ start: 9, end: 14 }],
      [{ start: 14, end: 28 }],
      [],
      [{ start: 28, end: 50 }],
    ]);
  });

  it('ends the last step at the transcript end when the video length is unknown', () => {
    expect(heuristicStepClips(steps, TRANSCRIPT, null)[3]).toEqual([{ start: 28, end: 40 }]);
  });
});

describe('normalizeClipRanges', () => {
  it('sorts, merges touching ranges and drops slivers', () => {
    expect(
      normalizeClipRanges(
        [
          { start: 40, end: 52 },
          { start: 10, end: 20 },
          { start: 20.6, end: 24 },
          { start: 30, end: 30.8 },
        ],
        null,
      ),
    ).toEqual([
      { start: 10, end: 24 },
      { start: 40, end: 52 },
    ]);
  });

  it('clamps to the video and rounds to tenths', () => {
    expect(normalizeClipRanges([{ start: -2, end: 3.333 }, { start: 58, end: 75 }], 60)).toEqual([
      { start: 0, end: 3.3 },
      { start: 58, end: 60 },
    ]);
  });

  it('ignores malformed entries', () => {
    expect(parseClipRanges([{ start: 'a', end: 3 }, null, { start: 5, end: 2 }, { start: 1, end: 9 }])).toEqual([
      { start: 1, end: 9 },
    ]);
    expect(parseClipRanges({ start: 1, end: 9 })).toEqual([]);
    expect(parseClipRanges(null)).toEqual([]);
  });
});
