import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { LocalStorageProvider } from '../../../../src/infrastructure/storage/local/local-storage-provider.js';

describe('LocalStorageProvider', () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('uploads, downloads and deletes files', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'storage-test-'));
    const storage = new LocalStorageProvider(tempDir);

    const data = Buffer.from('test artifact');
    const stored = await storage.upload('jobs/test/file.bin', data, {
      contentType: 'application/octet-stream',
    });

    expect(stored.sizeBytes).toBe(data.byteLength);

    const downloaded = await storage.download('jobs/test/file.bin');
    expect(downloaded.toString()).toBe('test artifact');

    await storage.delete('jobs/test/file.bin');
  });

  it('rejects path traversal keys', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'storage-test-'));
    const storage = new LocalStorageProvider(tempDir);

    await expect(
      storage.upload('../escape.txt', Buffer.from('x'), { contentType: 'text/plain' }),
    ).rejects.toThrow('Invalid storage key');
  });
});
