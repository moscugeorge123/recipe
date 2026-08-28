import type { AssetType, MediaAsset, PrismaClient } from '@prisma/client';

import type {
  CreateMediaAssetInput,
  IMediaAssetRepository,
} from '../../../modules/media/repository/media-asset.repository.js';

export class PrismaMediaAssetRepository implements IMediaAssetRepository {
  constructor(private readonly db: PrismaClient) {}

  create(input: CreateMediaAssetInput): Promise<MediaAsset> {
    return this.db.mediaAsset.create({
      data: {
        jobId: input.jobId,
        assetType: input.assetType,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        ...(input.durationSeconds !== undefined ? { durationSeconds: input.durationSeconds } : {}),
        metadata: input.metadata ?? {},
        ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
      },
    });
  }

  findByJobAndType(jobId: string, assetType: AssetType): Promise<MediaAsset[]> {
    return this.db.mediaAsset.findMany({
      where: { jobId, assetType },
      orderBy: { createdAt: 'asc' },
    });
  }

  findByJobId(jobId: string): Promise<MediaAsset[]> {
    return this.db.mediaAsset.findMany({
      where: { jobId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
