import type { EvidenceSource, EvidenceType } from '@prisma/client';

export interface EvidenceItem {
  evidenceType: EvidenceType;
  value: string;
  source: EvidenceSource;
  timestampSeconds?: number;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface ExtractionEvidenceBundle {
  items: EvidenceItem[];
}
