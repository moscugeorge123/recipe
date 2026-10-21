import { randomUUID } from 'node:crypto';

export const PHOTO_URL_SCHEME = 'photo:';

export type PhotoMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

const EXTENSIONS: Record<PhotoMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MIME_BY_EXTENSION: Record<string, PhotoMimeType> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** The real image type from the file's first bytes; the client's declared type is not trusted. */
export function sniffImageType(data: Buffer): PhotoMimeType | undefined {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    data.length >= 8 &&
    data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    data.length >= 12 &&
    data.toString('ascii', 0, 4) === 'RIFF' &&
    data.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return undefined;
}

export interface PhotoPage {
  /** 1-based page position. */
  index: number;
  storageKey: string;
  mimeType: PhotoMimeType;
}

export function newPhotoImportId(): string {
  return randomUUID();
}

export function photoStorageKey(importId: string, index: number, mimeType: PhotoMimeType): string {
  return `photo-imports/${importId}/${String(index).padStart(2, '0')}.${EXTENSIONS[mimeType]}`;
}

/**
 * The source URL of a photo import: `photo://<importId>?pages=jpg,png`. It is internal (the API
 * builds it; `/recipes/extract` only accepts http(s)) and carries what the worker needs to find
 * the uploaded pages in storage.
 */
export function buildPhotoSourceUrl(importId: string, mimeTypes: PhotoMimeType[]): string {
  return `photo://${importId}?pages=${mimeTypes.map((type) => EXTENSIONS[type]).join(',')}`;
}

const IMPORT_ID = /^[0-9a-f-]{36}$/i;

export function parsePhotoSourceUrl(url: string): { importId: string; pages: PhotoPage[] } | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== PHOTO_URL_SCHEME) return undefined;

  const importId = parsed.hostname;
  if (!IMPORT_ID.test(importId) || (parsed.pathname !== '' && parsed.pathname !== '/')) {
    return undefined;
  }

  const pages: PhotoPage[] = [];
  for (const [position, extension] of (parsed.searchParams.get('pages') ?? '').split(',').entries()) {
    const mimeType = MIME_BY_EXTENSION[extension];
    if (!mimeType) return undefined;
    const index = position + 1;
    pages.push({ index, storageKey: photoStorageKey(importId, index, mimeType), mimeType });
  }
  return pages.length > 0 ? { importId, pages } : undefined;
}
