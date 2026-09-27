import type { MediaOrigin } from '../../ocr/domain/types.js';

export interface VisionObservation {
  type: string;
  description: string;
  confidence: number;
}

export interface VisionAnalysis extends MediaOrigin {
  observations: VisionObservation[];
  timestampSeconds?: number;
  provider: Record<string, unknown>;
}

export interface ImageInput extends MediaOrigin {
  data: Buffer;
  mimeType: string;
  timestampSeconds?: number;
}

export interface VisionContext {
  prompt?: string;
}

export interface VisionProvider {
  analyzeImages(images: ImageInput[], ctx?: VisionContext): Promise<VisionAnalysis[]>;
}
