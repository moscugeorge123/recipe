export interface ModelPricing {
  inputPer1kTokens: number;
  outputPer1kTokens: number;
}

export interface AIPricingTable {
  [model: string]: ModelPricing;
}

/** Default pricing estimates (USD per 1k tokens). Override via env in production. */
export const DEFAULT_PRICING: AIPricingTable = {
  'gpt-5-nano': { inputPer1kTokens: 0.00005, outputPer1kTokens: 0.0004 },
  'gpt-4.1-nano': { inputPer1kTokens: 0.0001, outputPer1kTokens: 0.0004 },
  'gpt-4o-mini': { inputPer1kTokens: 0.00015, outputPer1kTokens: 0.0006 },
  'gpt-4o': { inputPer1kTokens: 0.0025, outputPer1kTokens: 0.01 },
  // DeepSeek list prices at the peak rate (cache miss), USD per 1M tokens / 1000.
  'deepseek-flash': { inputPer1kTokens: 0.0003, outputPer1kTokens: 0.0012 },
  'deepseek-v4-pro': { inputPer1kTokens: 0.00132, outputPer1kTokens: 0.00396 },
  'whisper-1': { inputPer1kTokens: 0.006, outputPer1kTokens: 0 },
};

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  pricing: AIPricingTable = DEFAULT_PRICING,
): number {
  const rates = pricing[model] ?? pricing['gpt-4o-mini'] ?? { inputPer1kTokens: 0, outputPer1kTokens: 0 };
  return (
    (inputTokens / 1000) * rates.inputPer1kTokens +
    (outputTokens / 1000) * rates.outputPer1kTokens
  );
}
