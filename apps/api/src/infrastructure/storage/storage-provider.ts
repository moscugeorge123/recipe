import type { Readable } from 'node:stream';

export interface UploadOptions {
  contentType: string;
  metadata?: Record<string, string>;
}

export interface StoredFile {
  key: string;
  sizeBytes: number;
  contentType: string;
}

/** Abstraction over local disk (dev) and S3 (production). */
export interface StorageProvider {
  upload(key: string, data: Buffer | Readable, opts: UploadOptions): Promise<StoredFile>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, ttlSeconds: number): Promise<string>;
}
