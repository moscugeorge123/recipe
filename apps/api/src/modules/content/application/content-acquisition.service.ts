import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { AcquiredContent } from '../domain/types.js';
import type { ContentProviderRegistry } from '../domain/types.js';

export class ContentAcquisitionService {
  constructor(private readonly registry: ContentProviderRegistry) {}

  async acquire(
    url: string,
    jobId: string,
    outputLanguage: string,
  ): Promise<AcquiredContent> {
    const provider = this.registry.getProvider(url);
    const tempDir = path.join(os.tmpdir(), 'recipe-extraction', jobId);
    await mkdir(tempDir, { recursive: true });

    return provider.acquire(url, {
      jobId,
      outputLanguage,
      tempDir,
    });
  }
}
