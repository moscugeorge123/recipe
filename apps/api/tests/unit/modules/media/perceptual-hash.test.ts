import { describe, expect, it } from 'vitest';

import { averageHash, hammingDistance } from '../../../../src/modules/media/domain/perceptual-hash.js';

describe('perceptual hash', () => {
  it('produces identical hashes for identical buffers', () => {
    const buffer = Buffer.from([10, 20, 30, 40, 50, 60, 70, 80]);
    expect(averageHash(buffer)).toBe(averageHash(buffer));
  });

  it('produces different hashes for different buffers', () => {
    const a = Buffer.from(Array.from({ length: 256 }, (_, i) => i % 2));
    const b = Buffer.from(Array.from({ length: 256 }, (_, i) => (i % 2 === 0 ? 255 : 0)));
    expect(averageHash(a)).not.toBe(averageHash(b));
  });

  it('computes hamming distance between hashes', () => {
    expect(hammingDistance('ff', '00')).toBeGreaterThan(0);
    expect(hammingDistance('aa', 'aa')).toBe(0);
  });
});
