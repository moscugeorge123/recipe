import type { AIPricingTable } from './pricing.js';
import { estimateCost } from './pricing.js';
import type {
  AIUsageLink,
  IAIUsageRepository,
} from '../../database/repositories/ai-usage.repository.js';

export type TrackUsageInput = AIUsageLink & {
  provider: string;
  model: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
};

export class AIUsageTracker {
  constructor(
    private readonly repo: IAIUsageRepository,
    private readonly pricing: AIPricingTable,
    /** Account billed for rows that do not name one, e.g. the user who requested the job. */
    private readonly defaultUserId?: string,
  ) {}

  async track(input: TrackUsageInput): Promise<void> {
    const userId = input.userId ?? this.defaultUserId;
    await this.repo.create({
      ...input,
      ...(userId !== undefined ? { userId } : {}),
      estimatedCostUsd: estimateCost(
        input.model,
        input.inputTokens,
        input.outputTokens,
        this.pricing,
      ),
    });
  }
}
