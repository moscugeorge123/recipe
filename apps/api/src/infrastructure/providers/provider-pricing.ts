export interface ThirdPartyRate {
  provider: string;
  operation: string;
  usdPerUnit: number;
}

export interface ThirdPartyCharge {
  provider: string;
  operation: string;
  sourceType: string;
  units: number;
  estimatedCostUsd: number;
}

/**
 * Estimated third-party prices for one content-acquisition unit.
 * 0.0027 USD is an estimate for one Apify instagram-scraper result
 * (about $2.70 / 1,000 results) and is not an invoice.
 */
export const THIRD_PARTY_RATES: Record<string, ThirdPartyRate> = {
  INSTAGRAM: { provider: 'apify', operation: 'instagram-scraper', usdPerUnit: 0.0027 },
  YOUTUBE: { provider: 'yt-dlp', operation: 'video-download', usdPerUnit: 0 },
  FACEBOOK: { provider: 'meta', operation: 'content.acquire', usdPerUnit: 0 },
  TIKTOK: { provider: 'tiktok', operation: 'content.acquire', usdPerUnit: 0 },
  GENERIC_WEB: { provider: 'http', operation: 'page-fetch', usdPerUnit: 0 },
};

function roundUsd(amount: number): number {
  return Math.round(amount * 1_000_000) / 1_000_000;
}

export function thirdPartyCharge(sourceType: string, units = 1): ThirdPartyCharge {
  const rate = THIRD_PARTY_RATES[sourceType];
  if (!rate) {
    return {
      provider: 'unknown',
      operation: 'content.acquire',
      sourceType,
      units,
      estimatedCostUsd: 0,
    };
  }

  return {
    provider: rate.provider,
    operation: rate.operation,
    sourceType,
    units,
    estimatedCostUsd: roundUsd(units * rate.usdPerUnit),
  };
}
