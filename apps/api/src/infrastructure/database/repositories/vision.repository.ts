import type { VisionAnalysis as PrismaVisionAnalysis, Prisma, PrismaClient } from '@prisma/client';

export interface CreateVisionAnalysisInput {
  mediaAssetId: string;
  observations: Prisma.InputJsonValue;
  timestampSeconds?: number | null;
  provider: Prisma.InputJsonValue;
}

export interface IVisionRepository {
  create(input: CreateVisionAnalysisInput): Promise<PrismaVisionAnalysis>;
  findByMediaAssetId(mediaAssetId: string): Promise<PrismaVisionAnalysis[]>;
}

export class PrismaVisionRepository implements IVisionRepository {
  constructor(private readonly db: PrismaClient) {}

  create(input: CreateVisionAnalysisInput): Promise<PrismaVisionAnalysis> {
    return this.db.visionAnalysis.create({
      data: {
        mediaAssetId: input.mediaAssetId,
        observations: input.observations,
        timestampSeconds: input.timestampSeconds ?? null,
        provider: input.provider,
      },
    });
  }

  findByMediaAssetId(mediaAssetId: string): Promise<PrismaVisionAnalysis[]> {
    return this.db.visionAnalysis.findMany({ where: { mediaAssetId } });
  }
}
