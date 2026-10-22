import { describe, expect, it } from 'vitest';

import { PhotoContentProvider } from '../../../../src/modules/content/providers/photo/photo-content-provider.js';
import {
  buildPhotoSourceUrl,
  parsePhotoSourceUrl,
  photoStorageKey,
  sniffImageType,
} from '../../../../src/modules/content/providers/photo/photo-source.js';
import { ContentAcquisitionFailedError } from '../../../../src/shared/errors/extraction-errors.js';

const ID = '6f1c7f0e-8f5b-4c53-a7aa-5d8f5d1c2b11';
const ctx = { jobId: 'job-1', outputLanguage: 'en', tempDir: '/tmp/test-photo' };

describe('sniffImageType', () => {
  it('recognises JPEG, PNG and WebP by their signatures', () => {
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('image/jpeg');
    expect(
      sniffImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])),
    ).toBe('image/png');
    expect(sniffImageType(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
  });

  it('rejects everything else', () => {
    expect(sniffImageType(Buffer.from('GIF89a......'))).toBeUndefined();
    expect(sniffImageType(Buffer.from('<html></html>'))).toBeUndefined();
    expect(sniffImageType(Buffer.alloc(0))).toBeUndefined();
  });
});

describe('photo source URL', () => {
  it('round-trips the page list and storage keys', () => {
    const url = buildPhotoSourceUrl(ID, ['image/jpeg', 'image/png']);
    expect(url).toBe(`photo://${ID}?pages=jpg,png`);
    expect(parsePhotoSourceUrl(url)).toEqual({
      importId: ID,
      pages: [
        { index: 1, storageKey: photoStorageKey(ID, 1, 'image/jpeg'), mimeType: 'image/jpeg' },
        { index: 2, storageKey: `photo-imports/${ID}/02.png`, mimeType: 'image/png' },
      ],
    });
  });

  it.each([
    'https://example.com/a.jpg',
    'photo://not-a-uuid?pages=jpg',
    `photo://${ID}`,
    `photo://${ID}?pages=exe`,
    `photo://${ID}/../../etc?pages=jpg`,
  ])('rejects %s', (url) => {
    expect(parsePhotoSourceUrl(url)).toBeUndefined();
  });
});

describe('PhotoContentProvider', () => {
  const provider = new PhotoContentProvider();

  it('only claims photo:// sources', () => {
    expect(provider.supports(`photo://${ID}?pages=jpg`)).toBe(true);
    expect(provider.supports('https://example.com/photo')).toBe(false);
  });

  it('lists the uploaded pages as stored, numbered slides', async () => {
    const content = await provider.acquire(buildPhotoSourceUrl(ID, ['image/jpeg', 'image/webp']), ctx);

    expect(content.sourceType).toBe('PHOTO');
    expect(content.caption).toBeUndefined();
    expect(content.images).toEqual([
      {
        url: `photo://${ID}?pages=jpg,webp`,
        mimeType: 'image/jpeg',
        slideIndex: 1,
        storageKey: `photo-imports/${ID}/01.jpg`,
      },
      {
        url: `photo://${ID}?pages=jpg,webp`,
        mimeType: 'image/webp',
        slideIndex: 2,
        storageKey: `photo-imports/${ID}/02.webp`,
      },
    ]);
    expect(content.metadata).toMatchObject({ provider: 'upload', pageCount: 2 });
  });

  it('fails on a malformed source URL', async () => {
    await expect(provider.acquire('photo://nope', ctx)).rejects.toBeInstanceOf(
      ContentAcquisitionFailedError,
    );
  });
});
