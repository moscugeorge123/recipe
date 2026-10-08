import { describe, expect, it, vi } from 'vitest';

import type { CreateProviderUsageInput } from '../../../../src/infrastructure/database/repositories/provider-usage.repository.js';
import { silentLogger } from '../../../../src/infrastructure/logging/logger.js';
import { ContentAcquisitionService } from '../../../../src/modules/content/application/content-acquisition.service.js';
import type { ProviderChargeRecorder } from '../../../../src/modules/content/application/content-acquisition.service.js';
import type {
  AcquiredContent,
  ContentProvider,
  ContentProviderRegistry,
} from '../../../../src/modules/content/domain/types.js';

function instagramProvider(): ContentProvider {
  return {
    sourceType: 'INSTAGRAM',
    supports: () => true,
    async acquire(url): Promise<AcquiredContent> {
      return {
        sourceType: 'INSTAGRAM',
        originalUrl: url,
        normalizedUrl: url,
        images: [],
        metadata: { provider: 'apify' },
      };
    },
  };
}

function registryFor(provider: ContentProvider): ContentProviderRegistry {
  return {
    getProvider: () => provider,
    register: () => undefined,
    detectSourceType: () => provider.sourceType,
  };
}

describe('ContentAcquisitionService provider charges', () => {
  it('records an Apify charge of 0.0027 USD after a successful Instagram acquire', async () => {
    const records: CreateProviderUsageInput[] = [];
    const charges: ProviderChargeRecorder = {
      record: async (input) => {
        records.push(input);
      },
    };

    const service = new ContentAcquisitionService(
      registryFor(instagramProvider()),
      silentLogger(),
      charges,
    );
    const content = await service.acquire('https://www.instagram.com/reel/abc123/', 'job-1', 'en');

    expect(content.sourceType).toBe('INSTAGRAM');
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      jobId: 'job-1',
      provider: 'apify',
      operation: 'instagram-scraper',
      sourceType: 'INSTAGRAM',
      units: 1,
      estimatedCostUsd: 0.0027,
    });
    expect(records[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('still resolves when recording the charge throws', async () => {
    const charges: ProviderChargeRecorder = {
      record: async () => {
        throw new Error('usage write failed');
      },
    };

    const service = new ContentAcquisitionService(
      registryFor(instagramProvider()),
      silentLogger(),
      charges,
    );

    await expect(
      service.acquire('https://www.instagram.com/reel/abc123/', 'job-2', 'en'),
    ).resolves.toMatchObject({ sourceType: 'INSTAGRAM' });
  });

  it('still resolves when no charge recorder is passed', async () => {
    const service = new ContentAcquisitionService(registryFor(instagramProvider()));

    await expect(
      service.acquire('https://www.instagram.com/reel/abc123/', 'job-3', 'en'),
    ).resolves.toMatchObject({ sourceType: 'INSTAGRAM' });
  });

  it('does not record a charge when acquire fails', async () => {
    const record = vi.fn(async () => undefined);
    const provider: ContentProvider = {
      sourceType: 'INSTAGRAM',
      supports: () => true,
      acquire: async () => {
        throw new Error('scrape failed');
      },
    };

    const service = new ContentAcquisitionService(registryFor(provider), silentLogger(), {
      record,
    });

    await expect(
      service.acquire('https://www.instagram.com/reel/abc123/', 'job-4', 'en'),
    ).rejects.toThrow('scrape failed');
    expect(record).not.toHaveBeenCalled();
  });
});
