import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { AppLogger } from '../../../infrastructure/logging/logger.js';
import { silentLogger } from '../../../infrastructure/logging/logger.js';
import { logStep } from '../../../infrastructure/logging/log-step.js';
import type { AcquiredContent } from '../domain/types.js';
import type { ContentProviderRegistry } from '../domain/types.js';

export class ContentAcquisitionService {
  constructor(
    private readonly registry: ContentProviderRegistry,
    private readonly log: AppLogger = silentLogger(),
  ) {}

  async acquire(
    url: string,
    jobId: string,
    outputLanguage: string,
  ): Promise<AcquiredContent> {
    const provider = this.registry.getProvider(url);
    const jobLog = this.log.child({ jobId, sourceType: provider.sourceType });
    const tempDir = path.join(os.tmpdir(), 'recipe-extraction', jobId);
    await mkdir(tempDir, { recursive: true });

    return logStep(jobLog, 'content.acquire', { url }, () =>
      provider.acquire(url, {
        jobId,
        outputLanguage,
        tempDir,
        log: jobLog,
      }),
    );
  }
}
