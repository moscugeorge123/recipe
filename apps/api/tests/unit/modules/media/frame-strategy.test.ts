import { describe, expect, it } from 'vitest';

import { computeFrameTimestamps } from '../../../../src/modules/media/domain/types.js';

describe('frame strategy', () => {
  it('generates timestamps at the configured interval', () => {
    const timestamps = computeFrameTimestamps(10, {
      intervalSeconds: 2,
      maxFrames: 150,
      maxDurationSeconds: 600,
    });

    expect(timestamps).toEqual([0, 2, 4, 6, 8]);
  });

  it('caps frames by maxFrames', () => {
    const timestamps = computeFrameTimestamps(100, {
      intervalSeconds: 2,
      maxFrames: 3,
      maxDurationSeconds: 600,
    });

    expect(timestamps).toEqual([0, 2, 4]);
  });

  it('caps duration by maxDurationSeconds', () => {
    const timestamps = computeFrameTimestamps(1000, {
      intervalSeconds: 2,
      maxFrames: 150,
      maxDurationSeconds: 6,
    });

    expect(timestamps).toEqual([0, 2, 4]);
  });
});
