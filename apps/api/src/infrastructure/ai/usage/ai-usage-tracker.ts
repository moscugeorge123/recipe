import type { AIPricingTable } from './pricing.js';
import { estimateCost } from './pricing.js';
import type { IAIUsageRepository } from '../../database/repositories/ai-usage.repository.js';

export interface TrackUsageInput {
  jobId: string;
  provider: string;
  model: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

export class AIUsageTracker {
  constructor(
    private readonly repo: IAIUsageRepository,
    private readonly pricing: AIPricingTable,
  ) {}

  async track(input: TrackUsageInput): Promise<void> {
    await this.repo.create({
      ...input,
      estimatedCostUsd: estimateCost(
        input.model,
        input.inputTokens,
        input.outputTokens,
        this.pricing,
      ),
    });
  }
}
