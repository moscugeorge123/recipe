import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { CreateProviderUsageInput } from '../../../infrastructure/database/repositories/provider-usage.repository.js';
import type { AppLogger } from '../../../infrastructure/logging/logger.js';
import { silentLogger } from '../../../infrastructure/logging/logger.js';
import { logStep } from '../../../infrastructure/logging/log-step.js';
import { thirdPartyCharge } from '../../../infrastructure/providers/provider-pricing.js';
import type { AcquiredContent, ContentProviderRegistry } from '../domain/types.js';

export interface ProviderChargeRecorder {
  record(input: CreateProviderUsageInput): Promise<void>;
}

export class ContentAcquisitionService {
  constructor(
    private readonly registry: ContentProviderRegistry,
    private readonly log: AppLogger = silentLogger(),
    private readonly charges?: ProviderChargeRecorder,
  ) {}

  async acquire(url: string, jobId: string, outputLanguage: string): Promise<AcquiredContent> {
    const provider = this.registry.getProvider(url);
    const jobLog = this.log.child({ jobId, sourceType: provider.sourceType });
    const tempDir = path.join(os.tmpdir(), 'recipe-extraction', jobId);
    await mkdir(tempDir, { recursive: true });

    let durationMs = 0;
    const result = await logStep(
      jobLog,
      'content.acquire',
      { url },
      async (): Promise<AcquiredContent> => {
        const startedAt = Date.now();
        const acquired = await provider.acquire(url, {
          jobId,
          outputLanguage,
          tempDir,
          log: jobLog,
        });
        durationMs = Date.now() - startedAt;
        return acquired;
      },
    );

    if (this.charges) {
      const charge = thirdPartyCharge(result.sourceType, 1);
      try {
        await this.charges.record({ jobId, ...charge, durationMs });
      } catch (error: unknown) {
        jobLog.error({ err: error }, 'provider usage recording failed');
      }
    }

    return result;
  }
}
