import {
  importErrorCodeOf,
  importFailureToast,
  scanFailureToast,
} from '@/lib/user-error';
import { ApiError } from '@/services/api-client';
import {
  ADVERTISED_BRANDS,
  advertisedSourcesText,
  supportOf,
  unsupportedSourceNote,
} from '@/features/share/sources';

describe('source support', () => {
  test('only sources the importer handles are advertised', () => {
    expect(ADVERTISED_BRANDS).toEqual(['instagram', 'youtube', 'facebook']);
    expect(advertisedSourcesText()).toBe(
      'Instagram, YouTube, Facebook or any recipe website',
    );
  });

  test('TikTok is unsupported, Facebook is imported, Pinterest is read as a web page', () => {
    expect(supportOf('tiktok')).toBe('unsupported');
    expect(supportOf('facebook')).toBe('supported');
    expect(supportOf('pinterest')).toBe('partial');
    expect(supportOf('instagram')).toBe('supported');
    expect(supportOf('web')).toBe('supported');
  });

  test('the unsupported note names the source', () => {
    expect(unsupportedSourceNote('TikTok')).toMatch(/^TikTok links can’t/);
  });
});

describe('import failure copy', () => {
  const codes = [
    'NOT_A_RECIPE',
    'UNSUPPORTED_SOURCE',
    'INVALID_URL',
    'HOST_NOT_FOUND',
    'BLOCKED',
    'NOT_FOUND',
    'CONTENT_ACQUISITION_FAILED',
    'TOO_MANY_REQUESTS',
    'EXTRACTION_FAILED',
    undefined,
  ];

  test.each(codes)('toast for %s fits two lines', (code) => {
    expect(importFailureToast(code, 'Instagram').length).toBeLessThanOrEqual(
      90,
    );
    expect(importFailureToast(code).length).toBeLessThanOrEqual(90);
  });

  test('a network error is not described as an unsupported source', () => {
    const toast = importFailureToast(
      importErrorCodeOf(new Error('Network request failed')),
    );
    expect(toast).not.toMatch(/supported|can’t be imported/);
  });

  test('a domain that does not resolve gets its own sentence', () => {
    const dead = new ApiError(
      'URL hostname could not be resolved',
      400,
      null,
      'INVALID_URL',
    );
    expect(importErrorCodeOf(dead)).toBe('HOST_NOT_FOUND');
    expect(importFailureToast(importErrorCodeOf(dead))).toBe(
      'We couldn’t find that site. Check the address and try again',
    );
    const malformed = new ApiError(
      'url must be a valid URL',
      400,
      null,
      'INVALID_URL',
    );
    expect(importErrorCodeOf(malformed)).toBe('INVALID_URL');
  });
});

describe('scan failure copy', () => {
  const codes = [
    'NOT_A_RECIPE',
    'PAYLOAD_TOO_LARGE',
    'UNSUPPORTED_MEDIA_TYPE',
    'PHOTO_UNREADABLE',
    'TOO_MANY_REQUESTS',
    'EXTRACTION_FAILED',
    undefined,
  ];

  test.each(codes)(
    'toast for %s fits two lines and names the photo',
    (code) => {
      const toast = scanFailureToast(code);
      expect(toast.length).toBeLessThanOrEqual(90);
      expect(toast).not.toMatch(/link/i);
    },
  );
});
