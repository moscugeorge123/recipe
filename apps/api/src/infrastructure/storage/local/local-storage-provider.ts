import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';

import type { StorageProvider, StoredFile, UploadOptions } from '../storage-provider.js';

/** Writes artifacts to a local directory during development. */
export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly basePath: string) {}

  private resolveKey(key: string): string {
    const resolved = path.resolve(this.basePath, key);
    if (!resolved.startsWith(path.resolve(this.basePath))) {
      throw new Error('Invalid storage key');
    }
    return resolved;
  }

  async upload(key: string, data: Buffer | Readable, opts: UploadOptions): Promise<StoredFile> {
    const filePath = this.resolveKey(key);
    await mkdir(path.dirname(filePath), { recursive: true });

    if (Buffer.isBuffer(data)) {
      await writeFile(filePath, data);
      return { key, sizeBytes: data.byteLength, contentType: opts.contentType };
    }

    const chunks: Buffer[] = [];
    for await (const chunk of data) {
      if (typeof chunk === 'string') {
        chunks.push(Buffer.from(chunk));
      } else if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
      } else {
        chunks.push(Buffer.from(chunk as Uint8Array));
      }
    }
    const buffer = Buffer.concat(chunks);
    await writeFile(filePath, buffer);
    return { key, sizeBytes: buffer.byteLength, contentType: opts.contentType };
  }

  async download(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  getSignedUrl(key: string, ttlSeconds: number): Promise<string> {
    void ttlSeconds;
    return Promise.resolve(`file://${this.resolveKey(key)}`);
  }
}
