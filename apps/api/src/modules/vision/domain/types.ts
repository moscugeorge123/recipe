export interface VisionObservation {
  type: string;
  description: string;
  confidence: number;
}

export interface VisionAnalysis {
  observations: VisionObservation[];
  timestampSeconds?: number;
  provider: Record<string, unknown>;
}

export interface ImageInput {
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
