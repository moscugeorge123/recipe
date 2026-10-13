/**
 * Where each method step happens inside the source video. A step can have several ranges:
 * creators often come back to a step ("season again", "now flip them") later in the video.
 *
 * The LLM aligner (`step-clip-aligner.ts`) reads the timed transcript and picks the ranges.
 * The heuristic here is its fallback: it finds where each step starts by matching words and
 * runs the step until the next one starts, so it only ever finds one range per step.
 */

export interface ClipSegment {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

/** A stretch of the source video, in seconds. */
export interface StepClipRange {
  start: number;
  end: number;
}

export interface ClipStepInput {
  title?: string | null;
  instruction: string;
  /** Work done before the cooking session. It is not narrated in cooking order, so it gets no clip. */
  ahead?: boolean;
}

/** Captions are short, so a step is matched against this many consecutive segments at a time. */
const WINDOW = 3;
/** Words of a step that can count towards a match, so long instructions are not penalised. */
const MAX_TARGET_TOKENS = 6;
const MIN_SHARED_TOKENS = 2;
const MIN_SCORE = 0.34;
/** One matched step says little; clips only appear when the method lines up with the video. */
export const MIN_MATCHED_STEPS = 2;
/** Ranges shorter than this are a stray word, not something worth watching. */
export const MIN_RANGE_SECONDS = 1.5;
/** Ranges of one step closer than this are played as one. */
const MERGE_GAP_SECONDS = 1;
export const MAX_RANGES_PER_STEP = 6;

const STOP_WORDS = new Set(
  (
    'the and with then that this into from your you are for add all out off over until about ' +
    'have has will just some more them they their there when what which while each also very ' +
    'can get got let make put take use using like need want next now once under'
  ).split(' '),
);

function stem(word: string): string {
  const base = word.replace(/(ing|ed|es|s)$/, '');
  return base.length >= 3 ? base : word;
}

export function clipTokens(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word))
    .map(stem);
}

/** Merged carousel videos concatenate segments from separate timelines; those can't be matched. */
export function isSingleTimeline(segments: readonly ClipSegment[]): boolean {
  let last = -1;
  for (const segment of segments) {
    if (!Number.isFinite(segment.startSeconds) || segment.startSeconds < 0) return false;
    if (segment.startSeconds < last) return false;
    last = segment.startSeconds;
  }
  return segments.length > 0;
}

/** Whole seconds covered by the transcript, or null when it has no timing. */
export function transcriptDurationSeconds(segments: readonly ClipSegment[]): number | null {
  let end = 0;
  for (const segment of segments) {
    if (Number.isFinite(segment.endSeconds) && segment.endSeconds > end) end = segment.endSeconds;
  }
  return end > 0 ? Math.ceil(end) : null;
}

const tenth = (seconds: number): number => Math.round(seconds * 10) / 10;

/**
 * Cleans one step's ranges: clamps them to the video, sorts them, joins overlapping or
 * nearly touching ones and drops slivers. Anything malformed is dropped rather than trusted.
 */
export function normalizeClipRanges(
  ranges: readonly unknown[],
  durationSeconds: number | null,
): StepClipRange[] {
  const limit = durationSeconds !== null && durationSeconds > 0 ? durationSeconds : Infinity;
  const valid = ranges
    .map((range) => {
      if (!range || typeof range !== 'object') return null;
      const { start, end } = range as Record<string, unknown>;
      if (typeof start !== 'number' || typeof end !== 'number') return null;
      if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
      const from = Math.max(0, start);
      const to = Math.min(end, limit);
      return to > from ? { start: from, end: to } : null;
    })
    .filter((range): range is StepClipRange => range !== null)
    .sort((a, b) => a.start - b.start);

  const merged: StepClipRange[] = [];
  for (const range of valid) {
    const last = merged[merged.length - 1];
    if (last && range.start - last.end <= MERGE_GAP_SECONDS) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged
    .filter((range) => range.end - range.start >= MIN_RANGE_SECONDS)
    .slice(0, MAX_RANGES_PER_STEP)
    .map((range) => ({ start: tenth(range.start), end: tenth(range.end) }));
}

/** Reads ranges stored as JSON; anything that isn't a list of ranges reads as no clip. */
export function parseClipRanges(value: unknown): StepClipRange[] {
  return Array.isArray(value) ? normalizeClipRanges(value, null) : [];
}

/** Clips only appear when the method lines up with the video in at least two places. */
export function enoughClips(clips: readonly (readonly StepClipRange[])[]): boolean {
  return clips.filter((ranges) => ranges.length > 0).length >= MIN_MATCHED_STEPS;
}

/**
 * One start time (whole seconds) per step, or null where the step could not be placed.
 * Steps are placed in order: each search starts after the previous step's start.
 */
export function alignStepClips(
  steps: readonly ClipStepInput[],
  segments: readonly ClipSegment[],
): Array<number | null> {
  const none = steps.map(() => null);
  if (steps.length < MIN_MATCHED_STEPS || !isSingleTimeline(segments)) return none;

  const segmentTokens: Array<Set<string>> = segments.map((segment) => new Set(clipTokens(segment.text)));
  const starts: Array<number | null> = [];
  let cursor = 0;

  for (const step of steps) {
    const target = step.ahead
      ? new Set<string>()
      : new Set(clipTokens([step.title, step.instruction].filter(Boolean).join(' ')));
    if (target.size < MIN_SHARED_TOKENS || cursor >= segments.length) {
      starts.push(null);
      continue;
    }

    const denominator = Math.min(target.size, MAX_TARGET_TOKENS);
    let bestScore = 0;
    let bestRank = 0;
    let startIndex = -1;
    for (let p = cursor; p < segments.length; p++) {
      // The caption that opens the window must itself mention the step, or the clip would start early.
      let anchorShared = 0;
      for (const token of segmentTokens[p] ?? []) if (target.has(token)) anchorShared++;
      if (anchorShared === 0) continue;

      const window = new Set<string>();
      for (let k = p; k < Math.min(segments.length, p + WINDOW); k++) {
        for (const token of segmentTokens[k] ?? []) window.add(token);
      }
      let shared = 0;
      for (const token of target) if (window.has(token)) shared++;
      if (shared < MIN_SHARED_TOKENS) continue;

      const score = shared / denominator;
      // Prefer the window whose first caption says the most about the step, then the earliest.
      const rank = score + (0.25 * anchorShared) / denominator;
      if (rank > bestRank) {
        bestRank = rank;
        bestScore = score;
        startIndex = p;
      }
    }

    if (startIndex < 0 || bestScore < MIN_SCORE) {
      starts.push(null);
      continue;
    }

    const start = Math.max(0, Math.floor(segments[startIndex]?.startSeconds ?? 0));
    starts.push(start);

    const after = segments.findIndex((segment, index) => index >= startIndex && Math.floor(segment.startSeconds) > start);
    cursor = after < 0 ? segments.length : after;
  }

  return starts.filter((start) => start !== null).length >= MIN_MATCHED_STEPS ? starts : none;
}

/**
 * Heuristic ranges: each placed step runs from its start to the next placed step's start,
 * or to the end of the video for the last one.
 */
export function heuristicStepClips(
  steps: readonly ClipStepInput[],
  segments: readonly ClipSegment[],
  durationSeconds: number | null,
): StepClipRange[][] {
  const starts = alignStepClips(steps, segments);
  const end = durationSeconds ?? transcriptDurationSeconds(segments);
  const placed = starts.filter((start): start is number => start !== null).sort((a, b) => a - b);
  return starts.map((start) => {
    if (start === null) return [];
    const next = placed.find((other) => other > start) ?? end ?? start;
    return normalizeClipRanges([{ start, end: next }], durationSeconds);
  });
}
