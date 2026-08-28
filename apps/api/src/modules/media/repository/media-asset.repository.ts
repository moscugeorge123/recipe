import type { AssetType, MediaAsset, Prisma } from '@prisma/client';

export interface CreateMediaAssetInput {
  jobId: string;
  assetType: AssetType;
  storageKey: string;
  mimeType: string;
  sizeBytes: bigint;
  durationSeconds?: number | null;
  metadata?: Prisma.InputJsonValue;
  expiresAt?: Date | null;
}

export interface IMediaAssetRepository {
  create(input: CreateMediaAssetInput): Promise<MediaAsset>;
  findByJobAndType(jobId: string, assetType: AssetType): Promise<MediaAsset[]>;
  findByJobId(jobId: string): Promise<MediaAsset[]>;
}
