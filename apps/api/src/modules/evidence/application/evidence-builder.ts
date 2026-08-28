import type { EvidenceType, EvidenceSource } from '@prisma/client';

import type { AcquiredContent } from '../../content/domain/types.js';
import type { OCRResult } from '../../ocr/domain/types.js';
import type { Transcript } from '../../transcription/domain/types.js';
import type { VisionAnalysis } from '../../vision/domain/types.js';
import type { EvidenceItem } from '../domain/types.js';

export interface EvidenceBuilderInput {
  acquiredContent?: AcquiredContent;
  transcript?: Transcript;
  ocrResults?: OCRResult[];
  visionAnalyses?: VisionAnalysis[];
}

const POST_TEXT_LIMIT = 50_000;
const OTHER_TEXT_LIMIT = 10_000;
const POST_TEXT_CONFIDENCE = 0.92;

export class EvidenceBuilder {
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

    if (input.transcript?.fullText) {
      items.push({
        evidenceType: 'TRANSCRIPT',
        value: this.sanitize(input.transcript.fullText),
        source: 'TRANSCRIPT',
        confidence: 0.8,
        metadata: { language: input.transcript.language },
      });
    }

    for (const ocr of input.ocrResults ?? []) {
      if (ocr.text.trim()) {
        items.push({
          evidenceType: 'OCR',
          value: this.sanitize(ocr.text),
          source: 'OCR',
          ...(ocr.timestampSeconds !== undefined ? { timestampSeconds: ocr.timestampSeconds } : {}),
          confidence: ocr.confidence,
        });
      }
    }

    for (const vision of input.visionAnalyses ?? []) {
      for (const obs of vision.observations) {
        items.push({
          evidenceType: 'VISION',
          value: this.sanitize(obs.description),
          source: 'VISION',
          ...(vision.timestampSeconds !== undefined
            ? { timestampSeconds: vision.timestampSeconds }
            : {}),
          confidence: obs.confidence,
          metadata: { observationType: obs.type },
        });
      }
    }

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
      OCR: 'OCR',
      VISION: 'Vision',
      METADATA: 'Metadata',
    };

    for (const [type, typeItems] of byType) {
      const label = typeLabels[type];
      const values = typeItems
        .filter((i) => !(i.evidenceType === 'METADATA' && i.metadata?.field === 'title'))
        .map((i) => {
        const ts =
          i.timestampSeconds !== undefined ? ` [${String(i.timestampSeconds)}s]` : '';
        return `- ${i.value}${ts} (confidence: ${String(i.confidence)})`;
      });
      if (values.length > 0) {
        sections.push(`${label}:\n${values.join('\n')}`);
      }
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
