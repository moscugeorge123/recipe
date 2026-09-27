import type { ContentCaptionTrack } from '../../domain/types.js';
import type { YtDlpMetadata, YtDlpSubtitleFormat } from './ytdlp-client.js';

export interface CaptionCandidate {
  kind: 'manual' | 'auto';
  language: string;
  format: 'json3' | 'vtt';
  url: string;
}

const FORMAT_PREFERENCE = ['json3', 'vtt'] as const;

function baseLanguage(code: string): string {
  return code.replace(/-orig$/, '').split(/[-_]/)[0]?.toLowerCase() ?? code.toLowerCase();
}

function pickFormat(
  formats: YtDlpSubtitleFormat[] | undefined,
): { format: CaptionCandidate['format']; url: string } | undefined {
  for (const wanted of FORMAT_PREFERENCE) {
    const match = formats?.find((f) => f.ext === wanted && f.url);
    if (match?.url) {
      return { format: wanted, url: match.url };
    }
  }
  return undefined;
}

/**
 * Chooses the best caption track yt-dlp exposes: uploader subtitles in the video's language,
 * then YouTube's original-language ASR track. Machine-translated auto captions are skipped
 * because the extractor handles translation itself.
 */
export function selectCaptionTrack(metadata: YtDlpMetadata): CaptionCandidate | undefined {
  const videoLang = metadata.language ? baseLanguage(metadata.language) : undefined;

  const manual = Object.entries(metadata.subtitles ?? {}).filter(([key]) => key !== 'live_chat');
  const manualOrdered = [
    ...manual.filter(([key]) => videoLang && baseLanguage(key) === videoLang),
    ...(videoLang ? [] : manual.filter(([key]) => baseLanguage(key) === 'en')),
    ...(videoLang ? [] : manual),
  ];
  for (const [key, formats] of manualOrdered) {
    const picked = pickFormat(formats);
    if (picked) {
      return { kind: 'manual', language: baseLanguage(key), ...picked };
    }
  }

  const auto = Object.entries(metadata.automatic_captions ?? {});
  const autoOrdered = [
    ...auto.filter(([key]) => key.endsWith('-orig') && (!videoLang || baseLanguage(key) === videoLang)),
    ...auto.filter(([key]) => videoLang !== undefined && key.toLowerCase() === videoLang),
    ...(videoLang ? [] : auto.filter(([key]) => key.endsWith('-orig'))),
  ];
  for (const [key, formats] of autoOrdered) {
    const picked = pickFormat(formats);
    if (picked) {
      return { kind: 'auto', language: baseLanguage(key), ...picked };
    }
  }

  return undefined;
}

type Segment = ContentCaptionTrack['segments'][number];

export function parseJson3Captions(body: string): Segment[] {
  const parsed = JSON.parse(body) as {
    events?: Array<{ tStartMs?: number; dDurationMs?: number; segs?: Array<{ utf8?: string }> }>;
  };
  const segments: Segment[] = [];
  for (const event of parsed.events ?? []) {
    const text = (event.segs ?? [])
      .map((s) => s.utf8 ?? '')
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) {
      continue;
    }
    const start = (event.tStartMs ?? 0) / 1000;
    segments.push({ startSeconds: start, endSeconds: start + (event.dDurationMs ?? 0) / 1000, text });
  }
  return segments;
}

function parseVttTimestamp(value: string): number {
  const parts = value.trim().split(':').map(Number);
  return parts.reduce((total, part) => total * 60 + (Number.isFinite(part) ? part : 0), 0);
}

export function parseVttCaptions(body: string): Segment[] {
  const segments: Segment[] = [];
  const blocks = body.replace(/\r/g, '').split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n');
    const timingIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingIndex === -1) {
      continue;
    }
    const [startRaw, endRaw] = (lines[timingIndex] ?? '').split('-->');
    const text = lines
      .slice(timingIndex + 1)
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) {
      continue;
    }
    segments.push({
      startSeconds: parseVttTimestamp(startRaw ?? '0'),
      endSeconds: parseVttTimestamp((endRaw ?? '0').trim().split(' ')[0] ?? '0'),
      text,
    });
  }
  return segments;
}

/**
 * Auto-caption VTT repeats each line while it scrolls ("add the" / "add the flour"). Drop
 * segments already covered by the previous one so the transcript reads once.
 */
export function collapseRollingSegments(segments: Segment[]): Segment[] {
  const result: Segment[] = [];
  for (const segment of segments) {
    const previous = result[result.length - 1];
    if (previous && (previous.text === segment.text || previous.text.endsWith(segment.text))) {
      previous.endSeconds = Math.max(previous.endSeconds, segment.endSeconds);
      continue;
    }
    if (previous && segment.text.startsWith(previous.text)) {
      previous.text = segment.text;
      previous.endSeconds = Math.max(previous.endSeconds, segment.endSeconds);
      continue;
    }
    result.push({ ...segment });
  }
  return result;
}

export function buildCaptionTrack(
  candidate: CaptionCandidate,
  body: string,
): ContentCaptionTrack | undefined {
  const raw = candidate.format === 'json3' ? parseJson3Captions(body) : parseVttCaptions(body);
  const segments = collapseRollingSegments(raw);
  const text = segments
    .map((s) => s.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) {
    return undefined;
  }
  return { kind: candidate.kind, language: candidate.language, text, segments };
}

export function formatChapters(chapters: YtDlpMetadata['chapters']): string[] {
  return (chapters ?? [])
    .filter((c) => c.title?.trim())
    .map((c) => `${formatClock(c.start_time ?? 0)} ${c.title?.trim() ?? ''}`);
}

function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h > 0 ? `${String(h)}:${String(m).padStart(2, '0')}:${s}` : `${String(m)}:${s}`;
}
