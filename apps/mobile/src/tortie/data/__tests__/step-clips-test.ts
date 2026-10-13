import {
  advancePlayback,
  barPieces,
  barSegments,
  buildClips,
  clipForStep,
  clipIndexForStep,
  clipRangeLabel,
  clipStartLabel,
  isVerticalVideo,
  moveTo,
  nextLabel,
  openLink,
  platformOf,
  playbackLeft,
  playbackRange,
  prevLabel,
  remainingSeconds,
  seekPlayback,
  startPlayback,
  tickPlayback,
  timelineEnd,
  togglePlayback,
  youtubeAt,
} from '@/tortie/data/step-clips';

const r = (start: number, end: number) => ({ start, end });

// A 74 s reel: intro until 3 s, step 1 from 3 s, step 2 from 29 s and again at 60 s ("flip
// them"), step 3 from 51 s; the last 6 s are an outro.
const MUSH = buildClips([[r(3, 29)], [r(29, 45), r(60, 68)], [r(51, 60)]], 74);

describe('buildClips', () => {
  test('keeps every part of a step and orders clips by where they start', () => {
    expect(MUSH).toEqual([
      { step: 0, parts: [r(3, 29)], start: 3, end: 29, length: 26 },
      {
        step: 1,
        parts: [r(29, 45), r(60, 68)],
        start: 29,
        end: 68,
        length: 24,
      },
      { step: 2, parts: [r(51, 60)], start: 51, end: 60, length: 9 },
    ]);
  });

  test('steps without ranges get no clip and keep their step index', () => {
    const clips = buildClips([undefined, [r(12, 40)], [], null], 100);
    expect(clips.map((c) => c.step)).toEqual([1]);
  });

  test('sorts and joins a step’s overlapping parts, and cuts them at the video end', () => {
    expect(
      buildClips([[r(50, 80), r(10, 20), r(15, 25)]], 60)[0]!.parts,
    ).toEqual([r(10, 25), r(50, 60)]);
  });

  test('drops empty, reversed and non-finite ranges', () => {
    expect(
      buildClips([[r(5, 5), r(9, 2), r(Number.NaN, 3), r(-4, 2)]], null)[0]!
        .parts,
    ).toEqual([r(0, 2)]);
    expect(buildClips([[r(5, 5)]], 30)).toEqual([]);
    expect(buildClips([], 30)).toEqual([]);
  });
});

describe('labels', () => {
  test('chip labels: a range for one part, the part count and length for several', () => {
    expect(clipStartLabel(MUSH[1]!)).toBe('0:29');
    expect(clipRangeLabel(MUSH[0]!)).toBe('0:03–0:29');
    expect(clipRangeLabel(MUSH[1]!)).toBe('2 parts · 0:24');
    expect(clipRangeLabel(buildClips([[r(95.4, 3725.9)]], null)[0]!)).toBe(
      '1:35–1:02:05',
    );
  });

  test('clipForStep finds a clip by step number', () => {
    expect(clipForStep(MUSH, 2)?.start).toBe(51);
    expect(clipForStep(MUSH, 5)).toBeNull();
    expect(clipIndexForStep(MUSH, 1)).toBe(1);
    expect(clipIndexForStep(MUSH, 9)).toBe(0);
  });

  test('previous and next buttons name the neighbouring step', () => {
    expect(prevLabel(MUSH, 0)).toBe('Previous');
    expect(prevLabel(MUSH, 2)).toBe('Step 2');
    expect(nextLabel(MUSH, 0)).toBe('Step 2');
    expect(nextLabel(MUSH, 2)).toBe('Last step');
    const sparse = buildClips([[], [r(12, 20)], [], [r(40, 50)]], 100);
    expect(nextLabel(sparse, 0)).toBe('Step 4');
  });
});

describe('timeline bar', () => {
  test('covers the whole video in chapters, with gaps for video that is no step', () => {
    expect(barPieces(MUSH, 74)).toEqual([
      { start: 0, end: 3, step: null },
      { start: 3, end: 29, step: 0 },
      { start: 29, end: 45, step: 1 },
      { start: 45, end: 51, step: null },
      { start: 51, end: 60, step: 2 },
      { start: 60, end: 68, step: 1 },
      { start: 68, end: 74, step: null },
    ]);
  });

  test('ends at the last clip when the video length is unknown', () => {
    expect(timelineEnd(MUSH, null)).toBe(68);
    expect(timelineEnd(MUSH, 74)).toBe(74);
    expect(timelineEnd([], null)).toBe(0);
    expect(barPieces(MUSH, null).at(-1)).toEqual({
      start: 60,
      end: 68,
      step: 1,
    });
  });

  test('a later part that overlaps another step starts where that one ends', () => {
    const clips = buildClips([[r(0, 20)], [r(15, 30)]], 30);
    expect(barPieces(clips, 30)).toEqual([
      { start: 0, end: 20, step: 0 },
      { start: 20, end: 30, step: 1 },
    ]);
  });

  test('highlights every part of the open step and fills up to the playhead', () => {
    const segs = barSegments(barPieces(MUSH, 74), 1, 37);
    expect(segs.map((s) => s.kind)).toEqual([
      'gap',
      'step',
      'active',
      'gap',
      'step',
      'active',
      'gap',
    ]);
    expect(segs.map((s) => s.fill)).toEqual([1, 1, 0.5, 0, 0, 0, 0]);
    expect(segs.map((s) => s.flex)).toEqual([3, 26, 16, 6, 9, 8, 6]);
  });
});

describe('playback', () => {
  test('a clip opens paused on its first part, waiting for the user', () => {
    expect(startPlayback(MUSH, 1)).toEqual({
      idx: 1,
      part: 0,
      pos: 29,
      playing: false,
      ended: false,
    });
    expect(startPlayback(MUSH, 1, true)?.playing).toBe(true);
    expect(startPlayback(MUSH, 3)).toBeNull();
    expect(startPlayback(MUSH, -1)).toBeNull();
  });

  test('plays the parts back to back, then stops on "Step clip done"', () => {
    const p = startPlayback(MUSH, 1, true)!;
    expect(advancePlayback(MUSH, p, 40)).toEqual({ p: { ...p, pos: 40 } });
    // End of part 1: jump over steps 3's footage to part 2.
    const jump = advancePlayback(MUSH, { ...p, pos: 44.9 }, 45);
    expect(jump).toEqual({ p: { ...p, part: 1, pos: 60 }, seek: 60 });
    // End of the last part.
    expect(advancePlayback(MUSH, jump.p, 68).p).toEqual({
      ...jump.p,
      pos: 68,
      playing: false,
      ended: true,
    });
  });

  test('a time before the part (a stale player report after a jump) holds at the part start', () => {
    const p = { ...startPlayback(MUSH, 1, true)!, part: 1, pos: 60 };
    expect(advancePlayback(MUSH, p, 44.8).p.pos).toBe(60);
  });

  test('nothing moves while paused or after the end', () => {
    const paused = startPlayback(MUSH, 0)!;
    expect(advancePlayback(MUSH, paused, 10).p).toBe(paused);
    expect(tickPlayback(MUSH, paused)).toBe(paused);
    const ended = { ...paused, pos: 29, ended: true };
    expect(tickPlayback(MUSH, ended)).toBe(ended);
  });

  test('simulated ticks move a quarter second', () => {
    expect(tickPlayback(MUSH, startPlayback(MUSH, 0, true)!).pos).toBe(3.25);
  });

  test('tapping the player plays, pauses, and replays an ended clip', () => {
    const p = startPlayback(MUSH, 1)!;
    const playing = togglePlayback(MUSH, p);
    expect(playing.playing).toBe(true);
    expect(togglePlayback(MUSH, playing).playing).toBe(false);
    const ended = { ...p, part: 1, pos: 68, ended: true };
    expect(togglePlayback(MUSH, ended)).toEqual(startPlayback(MUSH, 1, true));
  });

  test('previous and next jump clips, playing, and stop at the ends', () => {
    const p = startPlayback(MUSH, 0)!;
    expect(moveTo(MUSH, p, -1)).toBe(p);
    expect(moveTo(MUSH, p, 1)).toEqual(startPlayback(MUSH, 1, true));
    const last = startPlayback(MUSH, 2)!;
    expect(moveTo(MUSH, last, 1)).toBe(last);
  });

  test('a tap on the bar plays the step under it from there', () => {
    const pieces = barPieces(MUSH, 74);
    // 50% of 74 s = 37 s, inside step 2's first part.
    expect(seekPlayback(MUSH, pieces, 0.5)).toEqual({
      idx: 1,
      part: 0,
      pos: 37,
      playing: true,
      ended: false,
    });
    // 64 s: step 2's second part.
    expect(seekPlayback(MUSH, pieces, 64 / 74)).toMatchObject({
      idx: 1,
      part: 1,
      pos: 64,
    });
    // 47 s is no step: snap to the next part (step 3 at 51 s).
    expect(seekPlayback(MUSH, pieces, 47 / 74)).toMatchObject({
      idx: 2,
      part: 0,
      pos: 51,
    });
    // The intro snaps forward to step 1; the outro back to the last part.
    expect(seekPlayback(MUSH, pieces, 0)).toMatchObject({ idx: 0, pos: 3 });
    expect(seekPlayback(MUSH, pieces, 1)).toMatchObject({ idx: 1, part: 1 });
    expect(seekPlayback([], [], 0.5)).toBeNull();
  });

  test('range and countdown text count every part still to play', () => {
    const p = { ...startPlayback(MUSH, 1, true)!, pos: 40.2 };
    expect(playbackRange(MUSH, p)).toBe('Step 2 · part 1 of 2 · 0:29–0:45');
    expect(remainingSeconds(MUSH, p)).toBeCloseTo(4.8 + 8);
    expect(playbackLeft(MUSH, p)).toBe('0:13 left');
    expect(playbackRange(MUSH, startPlayback(MUSH, 0)!)).toBe(
      'Step 1 · 0:03–0:29',
    );
    expect(playbackLeft(MUSH, { ...p, part: 1, pos: 68, ended: true })).toBe(
      'Step clip done',
    );
  });
});

describe('platformOf / isVerticalVideo', () => {
  test('recognises the video platforms and plain websites', () => {
    expect(platformOf('https://www.instagram.com/reel/C7hPz/')?.key).toBe(
      'instagram',
    );
    expect(platformOf('https://youtu.be/abc')?.name).toBe('YouTube');
    expect(platformOf('https://www.tiktok.com/@a/video/1')?.key).toBe('tiktok');
    expect(platformOf('https://www.seriouseats.com/pan-roasted')).toEqual({
      key: 'web',
      name: 'Website',
    });
    expect(platformOf('')).toBeNull();
    expect(platformOf(null)).toBeNull();
    expect(platformOf('not a url')).toBeNull();
  });

  test('reels and TikToks are portrait, YouTube is wide unless it is a Short', () => {
    const url = 'https://www.instagram.com/reel/x/';
    expect(isVerticalVideo(platformOf(url), url)).toBe(true);
    const tt = 'https://www.tiktok.com/@a/video/1';
    expect(isVerticalVideo(platformOf(tt), tt)).toBe(true);
    const yt = 'https://www.youtube.com/watch?v=abc';
    expect(isVerticalVideo(platformOf(yt), yt)).toBe(false);
    const short = 'https://www.youtube.com/shorts/abc';
    expect(isVerticalVideo(platformOf(short), short)).toBe(true);
    expect(isVerticalVideo(null, null)).toBe(false);
  });
});

describe('openLink / youtubeAt', () => {
  test('YouTube links open at the clip start', () => {
    const url = 'https://www.youtube.com/watch?v=Qm8rT2braise';
    expect(openLink(url, platformOf(url), 215)).toEqual({
      href: 'https://www.youtube.com/watch?v=Qm8rT2braise&t=215s',
      label: 'Open in YouTube at 3:35',
    });
  });

  test('replaces a start time already on the link and keeps the rest', () => {
    expect(youtubeAt('https://youtu.be/abc?t=5', 90)).toBe(
      'https://youtu.be/abc?t=90s',
    );
    expect(youtubeAt('https://www.youtube.com/watch?t=5&v=abc', 90)).toBe(
      'https://www.youtube.com/watch?v=abc&t=90s',
    );
    expect(youtubeAt('https://www.youtube.com/watch?v=abc#frag', 7.9)).toBe(
      'https://www.youtube.com/watch?v=abc&t=7s',
    );
  });

  test('other platforms open the post as is', () => {
    const url = 'https://www.instagram.com/reel/C7hPz/';
    expect(openLink(url, platformOf(url), 31)).toEqual({
      href: url,
      label: 'Open on Instagram',
    });
  });

  test('no link without a source URL', () => {
    expect(openLink(null, null, 0)).toBeNull();
    expect(openLink('  ', null, 0)).toBeNull();
  });
});
