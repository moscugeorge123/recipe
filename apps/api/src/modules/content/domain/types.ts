import type { SourceType } from '@prisma/client';

import type { StructuredRecipe } from './structured-recipe.js';

export interface ContentImage {
  url: string;
  mimeType?: string;
  /**
   * 1-based position in the post (carousel slide or single image). Only images with a slide
   * index are treated as recipe content and sent to OCR/vision; thumbnails/covers omit it.
   */
  slideIndex?: number;
}

export interface ContentVideo {
  localPath: string;
  /** 1-based carousel slide position; omitted for single-video posts. */
  slideIndex?: number;
}

export interface ContentCaptionTrack {
  /** `manual` = uploader subtitles, `auto` = platform ASR captions. */
  kind: 'manual' | 'auto';
  language: string;
  text: string;
  segments: Array<{ startSeconds: number; endSeconds: number; text: string }>;
}

export interface AcquiredContent {
  sourceType: SourceType;
  originalUrl: string;
  normalizedUrl: string;
  title?: string;
  caption?: string;
  description?: string;
  author?: string;
  language?: string;
  videoUrl?: string;
  videoLocalPath?: string;
  /** Every downloaded video in post order (carousels can hold several); `videoLocalPath` is the first. */
  videos?: ContentVideo[];
  /** Subtitles/captions supplied by the platform, usable instead of speech-to-text. */
  captions?: ContentCaptionTrack;
  thumbnailUrl?: string;
  images: ContentImage[];
  metadata: Record<string, unknown>;
  /** schema.org Recipe parsed from the page (generic web only). Kept out of `metadata` so it isn't persisted as source provenance. */
  structuredRecipe?: StructuredRecipe;
  /** Readable main text of the page with scripts/nav stripped, length-capped. */
  pageText?: string;
}

export interface AcquireLogger {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

export interface AcquisitionContext {
  jobId: string;
  outputLanguage: string;
  tempDir: string;
  log?: AcquireLogger;
}

export interface ContentProvider {
  readonly sourceType: SourceType;
  supports(url: string): boolean;
  acquire(url: string, ctx: AcquisitionContext): Promise<AcquiredContent>;
}

export interface ContentProviderRegistry {
  getProvider(url: string): ContentProvider;
  register(provider: ContentProvider): void;
  detectSourceType(url: string): SourceType;
}
