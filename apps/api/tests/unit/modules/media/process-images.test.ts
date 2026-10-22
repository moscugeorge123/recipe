import { describe, expect, it, vi } from 'vitest';

import type { AppConfig } from '../../../../src/config/env.js';
import { MediaProcessingService } from '../../../../src/modules/media/application/media-processing.service.js';

function makeService() {
  const stored = new Map<string, Buffer>([['photo-imports/x/01.png', Buffer.from('uploaded-png')]]);
  const storage = {
    download: vi.fn((key: string) => {
      const data = stored.get(key);
      return data ? Promise.resolve(data) : Promise.reject(new Error('missing'));
    }),
    upload: vi.fn((key: string, data: Buffer) => {
      stored.set(key, data);
      return Promise.resolve({ key, sizeBytes: data.byteLength, contentType: 'image/png' });
    }),
  };
  const mediaAssetRepo = { create: vi.fn(() => Promise.resolve({})) };
  const fetchImpl = vi.fn(() => Promise.reject(new Error('must not fetch')));
  const service = new MediaProcessingService(
    {} as never,
    storage as never,
    mediaAssetRepo as never,
    { extraction: { maxPostImages: 20, maxMediaDownloadBytes: 1024 } } as AppConfig,
    undefined,
    fetchImpl,
  );
  return { service, storage, mediaAssetRepo, fetchImpl };
}

describe('MediaProcessingService.processImages with uploaded files', () => {
  it('reads the page from storage instead of fetching its URL', async () => {
    const { service, storage, mediaAssetRepo, fetchImpl } = makeService();

    const keys = await service.processImages({
      jobId: 'job-1',
      images: [
        {
          url: 'photo://x?pages=png',
          slideIndex: 1,
          storageKey: 'photo-imports/x/01.png',
          mimeType: 'image/png',
        },
      ],
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(keys).toEqual(['jobs/job-1/images/slide-01.png']);
    expect(storage.upload).toHaveBeenCalledWith(
      'jobs/job-1/images/slide-01.png',
      Buffer.from('uploaded-png'),
      { contentType: 'image/png' },
    );
    expect(mediaAssetRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        assetType: 'IMAGE',
        mimeType: 'image/png',
        metadata: { slideIndex: 1, uploadedKey: 'photo-imports/x/01.png' },
      }),
    );
  });

  it('skips a page that is missing from storage and keeps the rest', async () => {
    const { service } = makeService();

    const keys = await service.processImages({
      jobId: 'job-1',
      images: [
        { url: 'photo://x', slideIndex: 1, storageKey: 'photo-imports/x/gone.jpg' },
        { url: 'photo://x', slideIndex: 2, storageKey: 'photo-imports/x/01.png', mimeType: 'image/png' },
      ],
    });

    expect(keys).toEqual(['jobs/job-1/images/slide-02.png']);
  });
});
