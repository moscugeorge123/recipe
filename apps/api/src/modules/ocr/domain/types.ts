import type { Prisma } from '@prisma/client';

export interface OCRResult {
  text: string;
  timestampSeconds?: number;
  confidence: number;
  boundingBoxes: Prisma.InputJsonValue;
  provider: Prisma.InputJsonValue;
}

export interface ImageInput {
  data: Buffer;
  mimeType: string;
  timestampSeconds?: number;
}

export interface OCRProvider {
  analyzeImage(image: ImageInput): Promise<OCRResult>;
}
