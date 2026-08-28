/** Allowed MIME types for uploaded media assets. */
export const ALLOWED_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/webm',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/** Magic byte signatures for common media types. */
const MAGIC_SIGNATURES: { mime: string; bytes: number[]; offset?: number }[] = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },
  { mime: 'video/mp4', bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  { mime: 'audio/mpeg', bytes: [0xff, 0xfb] },
  { mime: 'audio/mpeg', bytes: [0x49, 0x44, 0x33] },
];

export function validateMimeType(declaredMime: string, buffer: Buffer): boolean {
  if (!ALLOWED_MIME_TYPES.has(declaredMime)) {
    return false;
  }

  const detected = detectMimeFromMagic(buffer);
  if (!detected) {
    return true;
  }

  const baseDeclared = declaredMime.split(';')[0]?.trim() ?? declaredMime;
  const baseDetected = detected.split(';')[0]?.trim() ?? detected;

  if (baseDeclared.startsWith('video/') && baseDetected.startsWith('video/')) {
    return true;
  }
  if (baseDeclared.startsWith('audio/') && baseDetected.startsWith('audio/')) {
    return true;
  }
  if (baseDeclared.startsWith('image/') && baseDetected.startsWith('image/')) {
    return true;
  }

  return baseDeclared === baseDetected;
}

export function detectMimeFromMagic(buffer: Buffer): string | null {
  for (const sig of MAGIC_SIGNATURES) {
    const offset = sig.offset ?? 0;
    if (buffer.length < offset + sig.bytes.length) {
      continue;
    }
    const match = sig.bytes.every((byte, i) => buffer[offset + i] === byte);
    if (match) {
      return sig.mime;
    }
  }
  return null;
}
