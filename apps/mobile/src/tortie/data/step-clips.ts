import type { ClipRange } from '@/features/recipes/types';
import { clock } from '@/tortie/lib/fmt';
import { tNow } from '@/i18n/format';

/**
 * Step clips ("Watch step"): the parts of the source video where one method step happens.
 * A step can have several parts when the video comes back to it; they play one after another,
 * skipping what lies between. The timeline bar shows the whole video split into chapters,
 * like YouTube's, with the open step's parts highlighted.
 */

export type ClipPart = ClipRange;

export type StepClip = {
  /** Zero-based index into the recipe's method steps. */
  step: number;
  /** In video order, never overlapping. */
  parts: ClipPart[];
  /** First part's start. */
  start: number;
  /** Last part's end. */
  end: number;
  /** Seconds of video across all parts. */
  length: number;
};

/** Simulated playback (no stored video) advances this much every `TICK_MS`. */
export const TICK_SECONDS = 0.25;
export const TICK_MS = 250;
/** A player reports time every quarter second; jump to the next part this close to the end. */
export const PART_END_SLACK = 0.15;

const secs = (s: number) => clock(Math.max(0, Math.floor(s)));

/**
 * Clips for the steps that have ranges, in video order. `ranges[i]` is step `i`'s ranges.
 * Ranges past the video's end are cut there; empty or invalid ones are dropped.
 */
export function buildClips(
  ranges: readonly (readonly ClipRange[] | null | undefined)[],
  duration: number | null | undefined,
): StepClip[] {
  const limit =
    typeof duration === 'number' && Number.isFinite(duration) && duration > 0
      ? duration
      : Infinity;
  const clips: StepClip[] = [];
  ranges.forEach((list, step) => {
    const parts = (list ?? [])
      .filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end))
      .map((r) => ({
        start: Math.max(0, r.start),
        end: Math.min(r.end, limit),
      }))
      .filter((r) => r.end > r.start)
      .sort((a, b) => a.start - b.start)
      .reduce<ClipPart[]>((out, r) => {
        const last = out[out.length - 1];
        if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
        else out.push({ ...r });
        return out;
      }, []);
    if (!parts.length) return;
    clips.push({
      step,
      parts,
      start: parts[0]!.start,
      end: parts[parts.length - 1]!.end,
      length: parts.reduce((sum, r) => sum + (r.end - r.start), 0),
    });
  });
  return clips.sort((a, b) => a.start - b.start || a.step - b.step);
}

export function clipForStep(
  clips: readonly StepClip[],
  step: number,
): StepClip | null {
  return clips.find((c) => c.step === step) ?? null;
}

/** The clip index to open for a step, falling back to the first clip. */
export function clipIndexForStep(
  clips: readonly StepClip[],
  step: number,
): number {
  const i = clips.findIndex((c) => c.step === step);
  return i < 0 ? 0 : i;
}

/** "0:29" for the chip on a method row. */
export function clipStartLabel(c: StepClip): string {
  return secs(c.start);
}

/** "0:29–0:51" for a one-part clip, "2 parts · 0:34" when the video comes back to the step. */
export function clipRangeLabel(c: StepClip): string {
  return c.parts.length === 1
    ? `${secs(c.start)}–${secs(c.end)}`
    : `${c.parts.length} parts · ${secs(Math.round(c.length))}`;
}

/* ─────────────────────────────── Timeline bar ─────────────────────────────── */

/** What a full bar stands for: the video's length, or the last clip's end when unknown. */
export function timelineEnd(
  clips: readonly StepClip[],
  duration?: number | null,
): number {
  const last = clips.reduce((m, c) => Math.max(m, c.end), 0);
  return typeof duration === 'number' &&
    Number.isFinite(duration) &&
    duration > last
    ? duration
    : last;
}

/** One chapter of the bar: a step's part, or video that belongs to no step (`step` null). */
export type BarPiece = { start: number; end: number; step: number | null };

/** The whole video as chapters, start to end, without gaps or overlaps. */
export function barPieces(
  clips: readonly StepClip[],
  duration?: number | null,
): BarPiece[] {
  const total = timelineEnd(clips, duration);
  const parts = clips
    .flatMap((c) =>
      c.parts.map((r) => ({ ...r, step: c.step as number | null })),
    )
    .sort((a, b) => a.start - b.start);
  const out: BarPiece[] = [];
  let at = 0;
  for (const r of parts) {
    const start = Math.max(r.start, at);
    if (r.end <= start) continue;
    if (start > at) out.push({ start: at, end: start, step: null });
    out.push({ start, end: r.end, step: r.step });
    at = r.end;
  }
  if (total > at) out.push({ start: at, end: total, step: null });
  return out;
}

export type BarSegment = {
  /** Flex weight, proportional to length (at least 1). */
  flex: number;
  /** `active`: a part of the open step; `step`: another step; `gap`: no step. */
  kind: 'active' | 'step' | 'gap';
  /** 0–1 played (everything before the playhead is filled, like YouTube). */
  fill: number;
};

export function barSegments(
  pieces: readonly BarPiece[],
  activeStep: number | null,
  pos: number,
): BarSegment[] {
  return pieces.map((x) => ({
    flex: Math.max(1, x.end - x.start),
    kind: x.step === null ? 'gap' : x.step === activeStep ? 'active' : 'step',
    fill:
      pos >= x.end
        ? 1
        : pos <= x.start
          ? 0
          : (pos - x.start) / (x.end - x.start),
  }));
}

/* ─────────────────────────────── Playback ─────────────────────────────── */

export type ClipPlayback = {
  /** Index into the clip list (not the step number). */
  idx: number;
  /** Index into the clip's parts. */
  part: number;
  /** Seconds into the source video. */
  pos: number;
  playing: boolean;
  /** The clip's last part reached its end. */
  ended: boolean;
};

/**
 * Open a clip at its first part. It waits for the user to press play unless `play` is set.
 * Null when `idx` is out of range.
 */
export function startPlayback(
  clips: readonly StepClip[],
  idx: number,
  play = false,
): ClipPlayback | null {
  const c = clips[idx];
  return c
    ? { idx, part: 0, pos: c.parts[0]!.start, playing: play, ended: false }
    : null;
}

export type PlaybackStep = {
  p: ClipPlayback;
  /** The player must jump here (the next part starts somewhere else in the video). */
  seek?: number;
};

/**
 * Playback reached `time` (from the player, or a simulated tick). At the end of a part it
 * jumps to the next part of the same step; after the last part it stops on "Step clip done".
 */
export function advancePlayback(
  clips: readonly StepClip[],
  p: ClipPlayback,
  time: number,
): PlaybackStep {
  const c = clips[p.idx];
  const part = c?.parts[p.part];
  if (!c || !part || !p.playing || p.ended) return { p };
  if (time < part.end - PART_END_SLACK)
    return { p: { ...p, pos: Math.max(time, part.start) } };
  const next = c.parts[p.part + 1];
  if (next) {
    return { p: { ...p, part: p.part + 1, pos: next.start }, seek: next.start };
  }
  return { p: { ...p, pos: part.end, playing: false, ended: true } };
}

/** Simulated playback: one tick forward. */
export function tickPlayback(
  clips: readonly StepClip[],
  p: ClipPlayback,
  dt: number = TICK_SECONDS,
): ClipPlayback {
  return advancePlayback(clips, p, p.pos + dt).p;
}

/** Tap on the player: play/pause, or replay from the first part once the clip has ended. */
export function togglePlayback(
  clips: readonly StepClip[],
  p: ClipPlayback,
): ClipPlayback {
  if (p.ended) return startPlayback(clips, p.idx, true) ?? p;
  return { ...p, playing: !p.playing };
}

/** Previous / next clip (`delta` -1 / +1), playing. Out of range leaves playback as is. */
export function moveTo(
  clips: readonly StepClip[],
  p: ClipPlayback,
  delta: number,
): ClipPlayback {
  return startPlayback(clips, p.idx + delta, true) ?? p;
}

/**
 * Tap on the bar at `fraction` (0–1) of its width: jump there and play. A tap on video that
 * belongs to no step lands on the start of the next step's part (or the previous one at the end).
 */
export function seekPlayback(
  clips: readonly StepClip[],
  pieces: readonly BarPiece[],
  fraction: number,
): ClipPlayback | null {
  if (!clips.length || !pieces.length) return null;
  const total = pieces[pieces.length - 1]!.end;
  const pos = Math.max(0, Math.min(1, fraction)) * total;
  const steps = pieces.filter((x) => x.step !== null);
  const hit =
    steps.find((x) => pos >= x.start && pos < x.end) ??
    steps.find((x) => x.start >= pos) ??
    steps[steps.length - 1];
  if (!hit) return null;
  const idx = clips.findIndex((c) => c.step === hit.step);
  const c = clips[idx];
  if (!c) return null;
  const part = Math.max(
    0,
    c.parts.findIndex((r) => r.start <= hit.start && hit.end <= r.end),
  );
  const at = Math.max(hit.start, Math.min(pos, hit.end - PART_END_SLACK * 2));
  return { idx, part, pos: at, playing: true, ended: false };
}

/** "Step 2 · 0:29–0:51", or "Step 2 · part 1 of 2 · 0:29–0:41" for a clip in parts. */
export function playbackRange(
  clips: readonly StepClip[],
  p: ClipPlayback,
): string {
  const c = clips[p.idx];
  const part = c?.parts[p.part];
  if (!c || !part) return '';
  const range = `${secs(part.start)}–${secs(part.end)}`;
  return c.parts.length > 1
    ? `Step ${c.step + 1} · part ${p.part + 1} of ${c.parts.length} · ${range}`
    : `Step ${c.step + 1} · ${range}`;
}

/** Seconds of the step still to play, across the current and later parts. */
export function remainingSeconds(
  clips: readonly StepClip[],
  p: ClipPlayback,
): number {
  const c = clips[p.idx];
  if (!c || p.ended) return 0;
  return c.parts.reduce((sum, r, i) => {
    if (i < p.part) return sum;
    if (i === p.part)
      return sum + Math.max(0, r.end - Math.max(p.pos, r.start));
    return sum + (r.end - r.start);
  }, 0);
}

/** "0:12 left", or "Step clip done" once it has ended. */
export function playbackLeft(
  clips: readonly StepClip[],
  p: ClipPlayback,
): string {
  if (!clips[p.idx]) return '';
  return p.ended
    ? tNow('clip.stepClipDone')
    : tNow('clip.timeLeft', {
        time: secs(Math.ceil(remainingSeconds(clips, p))),
      });
}

export function prevLabel(clips: readonly StepClip[], idx: number): string {
  const c = clips[idx - 1];
  return c ? tNow('common.stepN', { n: c.step + 1 }) : tNow('common.previous');
}

export function nextLabel(clips: readonly StepClip[], idx: number): string {
  const c = clips[idx + 1];
  return c ? tNow('common.stepN', { n: c.step + 1 }) : tNow('clip.lastStep');
}

/* ─────────────────────────────── Source platform ─────────────────────────────── */

export type ClipPlatformKey =
  'instagram' | 'tiktok' | 'youtube' | 'pinterest' | 'facebook' | 'web';
export type ClipPlatform = { key: ClipPlatformKey; name: string };

const PLATFORMS: { key: ClipPlatformKey; name: string; re: RegExp }[] = [
  { key: 'instagram', name: 'Instagram', re: /instagram\.com|instagr\.am/i },
  { key: 'tiktok', name: 'TikTok', re: /tiktok\.com/i },
  { key: 'youtube', name: 'YouTube', re: /youtube\.com|youtu\.be/i },
  { key: 'pinterest', name: 'Pinterest', re: /pinterest\.|pin\.it/i },
  { key: 'facebook', name: 'Facebook', re: /facebook\.com|fb\.watch/i },
];

/** Which platform a source link belongs to; any other web address is "Website". */
export function platformOf(
  url: string | null | undefined,
): ClipPlatform | null {
  const u = (url ?? '').trim();
  if (!u) return null;
  const hit = PLATFORMS.find((p) => p.re.test(u));
  if (hit) return { key: hit.key, name: hit.name };
  return /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/|$)/i.test(u)
    ? { key: 'web', name: tNow('tag.Website') }
    : null;
}

/** Reels, TikToks and Shorts play in a portrait frame; everything else is wide. */
export function isVerticalVideo(
  platform: ClipPlatform | null,
  url: string | null | undefined,
): boolean {
  if (!platform) return false;
  if (platform.key === 'instagram' || platform.key === 'tiktok') return true;
  return platform.key === 'youtube' && /\/shorts\//i.test(url ?? '');
}

/** YouTube link that starts at `start` seconds, replacing any start time already on it. */
export function youtubeAt(url: string, start: number): string {
  const hash = url.indexOf('#');
  const base = (hash < 0 ? url : url.slice(0, hash))
    .replace(/([?&])(t|start)=[^&]*&?/gi, '$1')
    .replace(/[?&]$/, '');
  return `${base}${base.includes('?') ? '&' : '?'}t=${Math.max(0, Math.floor(start))}s`;
}

/** Link and label for the "Open on …" row under the player. Null without a source link. */
export function openLink(
  url: string | null | undefined,
  platform: ClipPlatform | null,
  start: number,
): { href: string; label: string } | null {
  const u = (url ?? '').trim();
  if (!u) return null;
  if (platform?.key === 'youtube') {
    return {
      href: youtubeAt(u, start),
      label: tNow('clip.openInYoutubeAt', { time: secs(start) }),
    };
  }
  return {
    href: u,
    label: tNow('clip.openOn', {
      platform: platform?.name ?? tNow('tag.Website'),
    }),
  };
}
