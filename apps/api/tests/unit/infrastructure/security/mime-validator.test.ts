import { describe, expect, it } from 'vitest';

import { ALLOWED_MIME_TYPES, detectMimeFromMagic, validateMimeType } from '../../../../src/infrastructure/security/mime-validator.js';

describe('mime-validator', () => {
  it('allows declared JPEG with matching magic bytes', () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(validateMimeType('image/jpeg', buffer)).toBe(true);
  });

  it('rejects disallowed MIME types', () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff]);
    expect(validateMimeType('application/javascript', buffer)).toBe(false);
  });

  it('detects JPEG from magic bytes', () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff]);
    expect(detectMimeFromMagic(buffer)).toBe('image/jpeg');
  });

  it('lists common media MIME types', () => {
    expect(ALLOWED_MIME_TYPES.has('video/mp4')).toBe(true);
    expect(ALLOWED_MIME_TYPES.has('audio/mpeg')).toBe(true);
  });
});
