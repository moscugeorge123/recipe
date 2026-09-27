import type { OCRResult } from '../../ocr/domain/types.js';
import type { VisionAnalysis } from '../../vision/domain/types.js';
import type { EvidenceItem } from '../domain/types.js';

export interface MediaEvidenceOptions {
  /** Combined character budget for OCR + vision evidence. */
  maxChars: number;
}

/** Share of the media budget reserved for on-screen text, which usually carries the recipe. */
const OCR_BUDGET_SHARE = 0.75;
const MIN_TRUNCATED_CHARS = 200;
const PER_ITEM_LIMIT = 6_000;

interface Located {
  mediaKind?: 'frame' | 'image';
  slideIndex?: number;
  timestampSeconds?: number;
}

interface OcrEntry extends Located {
  text: string;
  key: string;
  confidence: number;
  endTimestampSeconds?: number;
}

function clean(value: string): string {
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, PER_ITEM_LIMIT);
}

function comparable(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function byPosition<T extends Located>(a: T, b: T): number {
  return (
    (a.slideIndex ?? 0) - (b.slideIndex ?? 0) ||
    (a.timestampSeconds ?? 0) - (b.timestampSeconds ?? 0)
  );
}

function formatSeconds(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Human-readable location, e.g. `Slide 3`, `Frame @12s`, `Slide 2 video @4–8s`. */
export function mediaLocationLabel(entry: Located & { endTimestampSeconds?: number }): string {
  if (entry.mediaKind === 'image') {
    return entry.slideIndex !== undefined ? `Slide ${String(entry.slideIndex)}` : 'Image';
  }
  const prefix = entry.slideIndex !== undefined ? `Slide ${String(entry.slideIndex)} video` : 'Frame';
  if (entry.timestampSeconds === undefined) {
    return prefix;
  }
  const range =
    entry.endTimestampSeconds !== undefined && entry.endTimestampSeconds > entry.timestampSeconds
      ? `${formatSeconds(entry.timestampSeconds)}–${formatSeconds(entry.endTimestampSeconds)}s`
      : `${formatSeconds(entry.timestampSeconds)}s`;
  return `${prefix} @${range}`;
}

function sameStream(a: Located, b: Located): boolean {
  return a.mediaKind !== 'image' && b.mediaKind !== 'image' && a.slideIndex === b.slideIndex;
}

/**
 * Collapses consecutive frames that show the same overlay. Overlays that build up line by
 * line ("1 cup flour" → "1 cup flour / 2 eggs") keep only the fuller version.
 */
function collapseOcr(results: OCRResult[]): OcrEntry[] {
  const entries: OcrEntry[] = [];
  const sorted = results
    .map((r) => ({ ...r, text: clean(r.text) }))
    .filter((r) => r.text.length > 0)
    .sort(byPosition);

  for (const result of sorted) {
    const key = comparable(result.text);
    if (!key) {
      continue;
    }
    const previous = entries[entries.length - 1];
    if (previous && sameStream(previous, result)) {
      const extend = (): void => {
        if (result.timestampSeconds !== undefined) {
          previous.endTimestampSeconds = result.timestampSeconds;
        }
        previous.confidence = Math.max(previous.confidence, result.confidence);
      };
      if (previous.key === key || previous.key.includes(key)) {
        extend();
        continue;
      }
      if (key.includes(previous.key)) {
        previous.text = result.text;
        previous.key = key;
        extend();
        continue;
      }
    }
    entries.push({
      text: result.text,
      key,
      confidence: result.confidence,
      ...(result.mediaKind ? { mediaKind: result.mediaKind } : {}),
      ...(result.slideIndex !== undefined ? { slideIndex: result.slideIndex } : {}),
      ...(result.timestampSeconds !== undefined ? { timestampSeconds: result.timestampSeconds } : {}),
    });
  }

  return entries;
}

function takeWithinBudget(value: string, remaining: number): string | undefined {
  if (value.length <= remaining) {
    return value;
  }
  return remaining >= MIN_TRUNCATED_CHARS ? `${value.slice(0, remaining).trimEnd()} …` : undefined;
}

/**
 * Evidence items for OCR and vision, ordered by slide then timestamp and labelled with where
 * they came from so the extractor can merge slides/overlays with the caption and transcript.
 */
export function buildMediaEvidence(
  ocrResults: OCRResult[],
  visionAnalyses: VisionAnalysis[],
  options: MediaEvidenceOptions,
): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  let used = 0;
  const ocrBudget = Math.floor(options.maxChars * OCR_BUDGET_SHARE);

  for (const entry of collapseOcr(ocrResults)) {
    const value = takeWithinBudget(entry.text, ocrBudget - used);
    if (!value) {
      break;
    }
    used += value.length;
    items.push({
      evidenceType: 'OCR',
      value,
      source: 'OCR',
      ...(entry.timestampSeconds !== undefined ? { timestampSeconds: entry.timestampSeconds } : {}),
      confidence: entry.confidence,
      metadata: {
        label: `${mediaLocationLabel(entry)} OCR`,
        mediaKind: entry.mediaKind ?? 'frame',
        ...(entry.slideIndex !== undefined ? { slideIndex: entry.slideIndex } : {}),
        ...(entry.endTimestampSeconds !== undefined
          ? { endTimestampSeconds: entry.endTimestampSeconds }
          : {}),
        ...(value !== entry.text ? { truncated: true } : {}),
      },
    });
  }

  const visionSorted = [...visionAnalyses].sort(byPosition);
  for (const analysis of visionSorted) {
    const observations = analysis.observations.filter((o) => o.description.trim());
    if (observations.length === 0) {
      continue;
    }
    const text = clean(
      observations.map((o) => (o.type ? `${o.type}: ${o.description}` : o.description)).join('; '),
    );
    const value = takeWithinBudget(text, options.maxChars - used);
    if (!value) {
      break;
    }
    used += value.length;
    items.push({
      evidenceType: 'VISION',
      value,
      source: 'VISION',
      ...(analysis.timestampSeconds !== undefined
        ? { timestampSeconds: analysis.timestampSeconds }
        : {}),
      confidence:
        Math.round(
          (observations.reduce((sum, o) => sum + o.confidence, 0) / observations.length) * 100,
        ) / 100,
      metadata: {
        label: `${mediaLocationLabel(analysis)} vision`,
        mediaKind: analysis.mediaKind ?? 'frame',
        ...(analysis.slideIndex !== undefined ? { slideIndex: analysis.slideIndex } : {}),
        observationTypes: observations.map((o) => o.type),
      },
    });
  }

  return items;
}
