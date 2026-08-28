import type { OCRResult as PrismaOCRResult, Prisma, PrismaClient } from '@prisma/client';

export interface CreateOCRResultInput {
  mediaAssetId: string;
  text: string;
  timestampSeconds?: number | null;
  confidence?: number;
  boundingBoxes?: Prisma.InputJsonValue;
  provider: Prisma.InputJsonValue;
}

export interface IOCRRepository {
  create(input: CreateOCRResultInput): Promise<PrismaOCRResult>;
  findByMediaAssetId(mediaAssetId: string): Promise<PrismaOCRResult[]>;
}

export class PrismaOCRRepository implements IOCRRepository {
  constructor(private readonly db: PrismaClient) {}

  create(input: CreateOCRResultInput): Promise<PrismaOCRResult> {
    return this.db.oCRResult.create({
      data: {
        mediaAssetId: input.mediaAssetId,
        text: input.text,
        timestampSeconds: input.timestampSeconds ?? null,
        confidence: input.confidence ?? 0,
        boundingBoxes: input.boundingBoxes ?? [],
        provider: input.provider,
      },
    });
  }

  findByMediaAssetId(mediaAssetId: string): Promise<PrismaOCRResult[]> {
    return this.db.oCRResult.findMany({ where: { mediaAssetId } });
  }
}
