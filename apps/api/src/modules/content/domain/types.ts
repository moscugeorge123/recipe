import type { SourceType } from '@prisma/client';

export interface ContentImage {
  url: string;
  mimeType?: string;
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
  thumbnailUrl?: string;
  images: ContentImage[];
  metadata: Record<string, unknown>;
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
