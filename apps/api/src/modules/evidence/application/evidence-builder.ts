import type { EvidenceType, EvidenceSource } from '@prisma/client';

import type { AcquiredContent } from '../../content/domain/types.js';
import type { OCRResult } from '../../ocr/domain/types.js';
import type { Transcript } from '../../transcription/domain/types.js';
import type { VisionAnalysis } from '../../vision/domain/types.js';
import type { EvidenceItem } from '../domain/types.js';
import {
  formatStructuredRecipe,
  PAGE_TEXT_FIELD,
  STRUCTURED_RECIPE_FIELD,
} from './structured-recipe-evidence.js';
import { buildMediaEvidence } from './media-evidence.js';

export interface EvidenceBuilderInput {
  acquiredContent?: AcquiredContent;
  transcript?: Transcript;
  ocrResults?: OCRResult[];
  visionAnalyses?: VisionAnalysis[];
}

const POST_TEXT_LIMIT = 50_000;
const OTHER_TEXT_LIMIT = 10_000;
const POST_TEXT_CONFIDENCE = 0.92;
const STRUCTURED_TEXT_LIMIT = 20_000;
const PAGE_TEXT_LIMIT = 12_000;
/** METADATA fields rendered as their own prompt sections rather than in the generic list. */
const SECTIONED_METADATA_FIELDS = new Set<unknown>(['title', STRUCTURED_RECIPE_FIELD, PAGE_TEXT_FIELD]);

export interface EvidenceBuilderLimits {
  /** EVIDENCE_MEDIA_MAX_CHARS: combined budget for OCR + vision text. */
  mediaMaxChars?: number;
  /** EVIDENCE_TRANSCRIPT_MAX_CHARS. */
  transcriptMaxChars?: number;
}

const DEFAULT_MEDIA_MAX_CHARS = 16_000;
const DEFAULT_TRANSCRIPT_MAX_CHARS = 20_000;

const TRANSCRIPT_SOURCE_LABELS: Record<NonNullable<Transcript['source']>, string> = {
  speech: 'spoken audio, speech-to-text',
  manual_captions: 'uploader subtitles',
  auto_captions: 'auto-generated captions',
};

export class EvidenceBuilder {
  constructor(private readonly limits: EvidenceBuilderLimits = {}) {}

  build(input: EvidenceBuilderInput): EvidenceItem[] {
    const items: EvidenceItem[] = [];

    const caption = input.acquiredContent?.caption?.trim();
    const description = input.acquiredContent?.description?.trim();

    if (caption) {
      items.push({
        evidenceType: 'CAPTION',
        value: this.sanitize(caption, POST_TEXT_LIMIT),
        source: 'CAPTION',
        confidence: POST_TEXT_CONFIDENCE,
      });
    }

    if (description && description !== caption) {
      items.push({
        evidenceType: 'DESCRIPTION',
        value: this.sanitize(description, POST_TEXT_LIMIT),
        source: 'METADATA',
        confidence: POST_TEXT_CONFIDENCE,
      });
    }

    if (input.acquiredContent?.title) {
      items.push({
        evidenceType: 'METADATA',
        value: this.sanitize(input.acquiredContent.title),
        source: 'METADATA',
        confidence: 0.7,
        metadata: { field: 'title' },
      });
    }

    const structured = input.acquiredContent?.structuredRecipe;
    if (structured) {
      const value = this.sanitize(formatStructuredRecipe(structured), STRUCTURED_TEXT_LIMIT);
      if (value) {
        items.push({
          evidenceType: 'METADATA',
          value,
          source: 'METADATA',
          confidence: 0.95,
          metadata: { field: STRUCTURED_RECIPE_FIELD, format: structured.source },
        });
      }
    }

    if (input.acquiredContent?.pageText?.trim()) {
      items.push({
        evidenceType: 'METADATA',
        value: this.sanitize(input.acquiredContent.pageText, PAGE_TEXT_LIMIT),
        source: 'METADATA',
        confidence: 0.6,
        metadata: { field: PAGE_TEXT_FIELD },
      });
    }

    const chapters = input.acquiredContent?.metadata.chapters;
    if (Array.isArray(chapters) && chapters.length > 0) {
      items.push({
        evidenceType: 'METADATA',
        value: this.sanitize(chapters.filter((c) => typeof c === 'string').join('\n')),
        source: 'METADATA',
        confidence: 0.75,
        metadata: { field: 'chapters', label: 'Video chapters' },
      });
    }

    if (input.transcript?.fullText.trim()) {
      const transcriptSource = input.transcript.source ?? 'speech';
      items.push({
        evidenceType: 'TRANSCRIPT',
        value: this.sanitize(
          input.transcript.fullText,
          this.limits.transcriptMaxChars ?? DEFAULT_TRANSCRIPT_MAX_CHARS,
        ),
        source: 'TRANSCRIPT',
        confidence: transcriptSource === 'manual_captions' ? 0.9 : 0.8,
        metadata: {
          language: input.transcript.language,
          transcriptSource,
          label: `Transcript (${TRANSCRIPT_SOURCE_LABELS[transcriptSource]})`,
        },
      });
    }

    items.push(
      ...buildMediaEvidence(input.ocrResults ?? [], input.visionAnalyses ?? [], {
        maxChars: this.limits.mediaMaxChars ?? DEFAULT_MEDIA_MAX_CHARS,
      }),
    );

    return items;
  }

  formatForPrompt(items: EvidenceItem[]): string {
    const sections: string[] = [];

    const titleItem = items.find(
      (i) => i.evidenceType === 'METADATA' && i.metadata?.field === 'title',
    );
    if (titleItem) {
      sections.push(`Title: ${titleItem.value}`);
    }

    const postTextItems = items.filter(
      (i) => i.evidenceType === 'CAPTION' || i.evidenceType === 'DESCRIPTION',
    );
    if (postTextItems.length > 0) {
      const values = postTextItems.map((i) => `- ${i.value}`);
      sections.push(
        `Post description (prefer this for ingredient quantities, units, servings, and calories):\n${values.join('\n')}`,
      );
    }

    const structuredItem = items.find(
      (i) => i.evidenceType === 'METADATA' && i.metadata?.field === STRUCTURED_RECIPE_FIELD,
    );
    if (structuredItem) {
      sections.push(
        `Structured recipe data published by the page (schema.org; the most reliable source for ingredients, quantities, steps, times, and yield):\n${structuredItem.value}`,
      );
    }

    const byType = new Map<EvidenceType, EvidenceItem[]>();
    for (const item of items) {
      if (item.evidenceType === 'CAPTION' || item.evidenceType === 'DESCRIPTION') {
        continue;
      }
      const list = byType.get(item.evidenceType) ?? [];
      list.push(item);
      byType.set(item.evidenceType, list);
    }

    const typeLabels: Record<EvidenceType, string> = {
      CAPTION: 'Caption',
      DESCRIPTION: 'Description',
      TRANSCRIPT: 'Transcript',
      OCR: 'On-screen text (OCR of video frames and post images/carousel slides, in slide/time order; merge with the caption and transcript)',
      VISION: 'Visual observations (vision model; lower confidence than text)',
      METADATA: 'Metadata',
    };

    for (const [type, typeItems] of byType) {
      const label = typeLabels[type];
      const values = typeItems
        .filter(
          (i) => !(i.evidenceType === 'METADATA' && SECTIONED_METADATA_FIELDS.has(i.metadata?.field)),
        )
        .map((i) => {
        const label = typeof i.metadata?.label === 'string' ? i.metadata.label : undefined;
        if (label) {
          const body = i.value.includes('\n') ? `\n  ${i.value.replace(/\n/g, '\n  ')}` : ` ${i.value}`;
          return `- [${label}]${body} (confidence: ${String(i.confidence)})`;
        }
        const ts =
          i.timestampSeconds !== undefined ? ` [${String(i.timestampSeconds)}s]` : '';
        return `- ${i.value}${ts} (confidence: ${String(i.confidence)})`;
      });
      if (values.length > 0) {
        sections.push(`${label}:\n${values.join('\n')}`);
      }
    }

    const pageTextItem = items.find(
      (i) => i.evidenceType === 'METADATA' && i.metadata?.field === PAGE_TEXT_FIELD,
    );
    if (pageTextItem) {
      sections.push(
        `Page text (readable text of the web page; may include unrelated chatter, ads, or comments):\n${pageTextItem.value}`,
      );
    }

    return sections.join('\n\n');
  }

  private sanitize(value: string, limit = OTHER_TEXT_LIMIT): string {
    return value
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .slice(0, limit)
      .trim();
  }
}

export type { EvidenceSource };
