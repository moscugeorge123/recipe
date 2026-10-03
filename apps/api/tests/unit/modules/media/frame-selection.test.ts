import { describe, expect, it } from 'vitest';

import {
  changedPixelRatio,
  deduplicateFramesBySignature,
} from '../../../../src/modules/media/domain/perceptual-hash.js';
import { effectiveFrameInterval, sampleEvenly } from '../../../../src/modules/media/domain/types.js';
import { isMeaningfulTranscript } from '../../../../src/modules/transcription/domain/transcript-quality.js';

function frame(overlay: number): Buffer {
  const pixels = Buffer.alloc(128 * 128, 180);
  // A small text-sized band (~0.4% of the frame) whose content differs per overlay.
  pixels.fill(overlay, 8000, 8064);
  return pixels;
}

describe('frame dedupe by pixel signature', () => {
  it('reports the fraction of meaningfully changed pixels', () => {
    expect(changedPixelRatio(frame(0), frame(0))).toBe(0);
    expect(changedPixelRatio(frame(0), frame(255))).toBeCloseTo(64 / (128 * 128));
    expect(changedPixelRatio(Buffer.alloc(4), Buffer.alloc(8))).toBe(1);
  });

  it('keeps frames that differ only by a small text overlay and drops true repeats', async () => {
    const frames = new Map([
      ['a', frame(0)],
      ['b', frame(0)],
      ['c', frame(255)],
      ['d', frame(255)],
      ['e', frame(0)],
    ]);
    const kept = await deduplicateFramesBySignature([...frames.keys()], {
      minChangedRatio: 0.002,
      signature: async (p) => frames.get(p) ?? Buffer.alloc(0),
    });
    expect(kept).toEqual([0, 2, 4]);
  });

  it('keeps a frame whose signature cannot be computed', async () => {
    const kept = await deduplicateFramesBySignature(['a', 'b'], {
      minChangedRatio: 0.5,
      signature: async (p) => {
        if (p === 'b') {
          throw new Error('decode failed');
        }
        return frame(0);
      },
    });
    expect(kept).toEqual([0, 1]);
  });
});

describe('frame sampling helpers', () => {
  it('widens the interval so maxFrames spans the whole video', () => {
    expect(effectiveFrameInterval(60, 1, 150)).toBe(1);
    expect(effectiveFrameInterval(600, 1, 150)).toBe(4);
    expect(effectiveFrameInterval(0, 2, 150)).toBe(2);
  });

  it('samples evenly and keeps first and last', () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    expect(sampleEvenly(items, 4)).toEqual([0, 3, 6, 9]);
    expect(sampleEvenly(items, 20)).toEqual(items);
    expect(sampleEvenly(items, 1)).toEqual([0]);
    expect(sampleEvenly(items, 0)).toEqual([]);
  });
});

describe('isMeaningfulTranscript', () => {
  it.each([
    '',
    '♪ ♪ ♪',
    '[Music]',
    '(upbeat music) Thank you for watching!',
    'Thanks for watching. Please subscribe.',
    'la la la la la la la',
    'you',
  ])('rejects %j', (text) => {
    expect(isMeaningfulTranscript(text)).toBe(false);
  });

  it.each([
    'Add two cups of flour and mix well.',
    '[Music] Today we are making a quick tomato soup, thank you for watching!',
    'Mélangez la farine avec les œufs.',
  ])('accepts %j', (text) => {
    expect(isMeaningfulTranscript(text)).toBe(true);
  });
});
