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

/** Deduplicates frames by perceptual hash similarity (Hamming distance threshold). */
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
