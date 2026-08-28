import { describe, expect, it } from 'vitest';

import { normalizeUrl, hashUrl } from '../../../../src/shared/utils/url.js';

describe('url utils', () => {
  it('normalizes URLs by lowercasing host and stripping tracking params', () => {
    const normalized = normalizeUrl(
      'https://WWW.Example.com/recipe/?utm_source=twitter&fbclid=abc',
    );

    expect(normalized).toBe('https://www.example.com/recipe');
  });

  it('produces stable hashes for normalized URLs', () => {
    const hashA = hashUrl('https://example.com/recipe');
    const hashB = hashUrl('https://example.com/recipe');

    expect(hashA).toBe(hashB);
    expect(hashA).toHaveLength(64);
  });
});
