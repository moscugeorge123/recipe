import { describe, expect, it } from 'vitest';

import { parseByteRange } from '../../../src/shared/http/file-range.js';

describe('parseByteRange', () => {
  it('serves the whole file without a usable header', () => {
    expect(parseByteRange(undefined, 1000)).toBeNull();
    expect(parseByteRange('items=0-5', 1000)).toBeNull();
    expect(parseByteRange('bytes=-', 1000)).toBeNull();
  });

  it('reads open, closed and suffix ranges', () => {
    expect(parseByteRange('bytes=0-', 1000)).toEqual({ start: 0, end: 999 });
    expect(parseByteRange('bytes=100-199', 1000)).toEqual({ start: 100, end: 199 });
    expect(parseByteRange('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseByteRange('bytes=-200', 1000)).toEqual({ start: 800, end: 999 });
  });

  it('rejects ranges past the end', () => {
    expect(parseByteRange('bytes=1000-', 1000)).toBe('unsatisfiable');
    expect(parseByteRange('bytes=50-10', 1000)).toBe('unsatisfiable');
    expect(parseByteRange('bytes=-0', 1000)).toBe('unsatisfiable');
  });
});
