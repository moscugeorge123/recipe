import { readFile } from 'node:fs/promises';

/** Computes a simple average hash (aHash) from raw image bytes for frame dedup. */
export function averageHash(imageBuffer: Buffer, bits = 64): string {
  const sampleSize = Math.min(imageBuffer.length, 4096);
  let sum = 0;

  for (let i = 0; i < sampleSize; i++) {
    sum += imageBuffer[i] ?? 0;
  }

  const mean = sum / sampleSize;
  const hashBits = Math.min(bits, sampleSize * 8);
  const bytesNeeded = Math.ceil(hashBits / 8);
  const hashBytes: number[] = [];

  for (let b = 0; b < bytesNeeded; b++) {
    let byte = 0;
    for (let bit = 0; bit < 8; bit++) {
      const index = b * 8 + bit;
      if (index >= sampleSize) {
        break;
      }
      if ((imageBuffer[index] ?? 0) >= mean) {
        byte |= 1 << (7 - bit);
      }
    }
    hashBytes.push(byte);
  }

  return hashBytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hammingDistance(hashA: string, hashB: string): number {
  const len = Math.min(hashA.length, hashB.length);
  let distance = 0;

  for (let i = 0; i < len; i += 2) {
    const a = Number.parseInt(hashA.slice(i, i + 2), 16);
    const b = Number.parseInt(hashB.slice(i, i + 2), 16);
    let xor = a ^ b;
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }

  return distance;
}

/** Per-pixel luma delta (0-255) that counts as a real change rather than JPEG noise. */
const PIXEL_CHANGE_THRESHOLD = 24;

/** Fraction of pixels that changed meaningfully between two equal-size grayscale signatures. */
export function changedPixelRatio(a: Buffer, b: Buffer): number {
  if (a.length === 0 || a.length !== b.length) {
    return 1;
  }
  let changed = 0;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs((a[i] ?? 0) - (b[i] ?? 0)) > PIXEL_CHANGE_THRESHOLD) {
      changed += 1;
    }
  }
  return changed / a.length;
}

export interface SignatureDedupeOptions {
  /** Keep a frame when at least this fraction of pixels differs from the last kept frame. */
  minChangedRatio: number;
  signature: (framePath: string) => Promise<Buffer>;
}

/**
 * Drops frames that look the same as the previously kept frame. Works on decoded pixels, so
 * two frames that differ only by a text overlay are both kept. Returns kept indices in order.
 */
export async function deduplicateFramesBySignature(
  framePaths: readonly string[],
  opts: SignatureDedupeOptions,
): Promise<number[]> {
  const kept: number[] = [];
  let last: Buffer | undefined;

  for (const [index, framePath] of framePaths.entries()) {
    let current: Buffer;
    try {
      current = await opts.signature(framePath);
    } catch {
      kept.push(index);
      last = undefined;
      continue;
    }

    if (!last || changedPixelRatio(last, current) >= opts.minChangedRatio) {
      kept.push(index);
      last = current;
    }
  }

  return kept;
}

/**
 * @deprecated Hashes encoded JPEG bytes (mostly identical headers), so distinct frames collapse
 * into one. Use {@link deduplicateFramesBySignature}.
 */
export async function deduplicateFrames(
  framePaths: string[],
  threshold = 5,
): Promise<string[]> {
  const kept: string[] = [];
  const hashes: string[] = [];

  for (const framePath of framePaths) {
    const buffer = await readFile(framePath);
    const hash = averageHash(buffer);

    const isDuplicate = hashes.some((existing) => hammingDistance(existing, hash) <= threshold);
    if (!isDuplicate) {
      kept.push(framePath);
      hashes.push(hash);
    }
  }

  return kept;
}
