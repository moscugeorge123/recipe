import type { Transcript as PrismaTranscript, Prisma, PrismaClient } from '@prisma/client';

export interface CreateTranscriptInput {
  mediaAssetId: string;
  language: string;
  fullText: string;
  provider: Prisma.InputJsonValue;
  segments: {
    startSeconds: number;
    endSeconds: number;
    text: string;
    confidence: number;
  }[];
}

export interface ITranscriptRepository {
  create(input: CreateTranscriptInput): Promise<PrismaTranscript>;
  findByMediaAssetId(mediaAssetId: string): Promise<PrismaTranscript | null>;
}

export class PrismaTranscriptRepository implements ITranscriptRepository {
  constructor(private readonly db: PrismaClient) {}

  create(input: CreateTranscriptInput): Promise<PrismaTranscript> {
    return this.db.transcript.create({
      data: {
        mediaAssetId: input.mediaAssetId,
        language: input.language,
        fullText: input.fullText,
        provider: input.provider,
        segments: {
          create: input.segments,
        },
      },
    });
  }

  findByMediaAssetId(mediaAssetId: string): Promise<PrismaTranscript | null> {
    return this.db.transcript.findUnique({ where: { mediaAssetId } });
  }
}
