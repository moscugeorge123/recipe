import type { Prisma } from '@prisma/client';

/** Where an analysed image came from, so evidence can be labelled and ordered. */
export interface MediaOrigin {
  /** `frame` = sampled from a video, `image` = a post image / carousel slide. */
  mediaKind?: 'frame' | 'image';
  /** 1-based carousel slide the image or video belongs to. */
  slideIndex?: number;
}

export interface OCRResult extends MediaOrigin {
  text: string;
  timestampSeconds?: number;
  confidence: number;
  boundingBoxes: Prisma.InputJsonValue;
  provider: Prisma.InputJsonValue;
}

export interface ImageInput extends MediaOrigin {
  data: Buffer;
  mimeType: string;
  timestampSeconds?: number;
}

export interface OCRProvider {
  analyzeImage(image: ImageInput): Promise<OCRResult>;
}
