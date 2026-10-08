import { describe, expect, it } from 'vitest';

import { thirdPartyCharge } from '../../../../src/infrastructure/providers/provider-pricing.js';

describe('thirdPartyCharge', () => {
  it('estimates one Instagram Apify result at 0.0027 USD', () => {
    expect(thirdPartyCharge('INSTAGRAM')).toEqual({
      provider: 'apify',
      operation: 'instagram-scraper',
      sourceType: 'INSTAGRAM',
      units: 1,
      estimatedCostUsd: 0.0027,
    });
  });

  it('charges nothing for a YouTube download', () => {
    expect(thirdPartyCharge('YOUTUBE')).toEqual({
      provider: 'yt-dlp',
      operation: 'video-download',
      sourceType: 'YOUTUBE',
      units: 1,
      estimatedCostUsd: 0,
    });
  });

  it('charges nothing for an unknown source type', () => {
    expect(thirdPartyCharge('PINTEREST')).toEqual({
      provider: 'unknown',
      operation: 'content.acquire',
      sourceType: 'PINTEREST',
      units: 1,
      estimatedCostUsd: 0,
    });
  });

  it('multiplies the per-unit rate and rounds to 6 decimal places', () => {
    expect(thirdPartyCharge('INSTAGRAM', 10)).toMatchObject({
      units: 10,
      estimatedCostUsd: 0.027,
    });
    expect(thirdPartyCharge('INSTAGRAM', 1000).estimatedCostUsd).toBe(2.7);
  });
});
