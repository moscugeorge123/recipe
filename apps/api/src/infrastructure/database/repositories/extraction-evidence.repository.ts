import type { ExtractionEvidence, EvidenceSource, EvidenceType, Prisma, PrismaClient } from '@prisma/client';

export interface CreateEvidenceInput {
  jobId: string;
  evidenceType: EvidenceType;
  value: string;
  source: EvidenceSource;
  timestampSeconds?: number | null;
  confidence?: number;
  metadata?: Prisma.InputJsonValue;
  recipeId?: string | null;
}

export interface IExtractionEvidenceRepository {
  createMany(inputs: CreateEvidenceInput[]): Promise<ExtractionEvidence[]>;
  findByJobId(jobId: string): Promise<ExtractionEvidence[]>;
}

export class PrismaExtractionEvidenceRepository implements IExtractionEvidenceRepository {
  constructor(private readonly db: PrismaClient) {}

  async createMany(inputs: CreateEvidenceInput[]): Promise<ExtractionEvidence[]> {
    const results: ExtractionEvidence[] = [];
    for (const input of inputs) {
      const created = await this.db.extractionEvidence.create({
        data: {
          jobId: input.jobId,
          evidenceType: input.evidenceType,
          value: input.value,
          source: input.source,
          timestampSeconds: input.timestampSeconds ?? null,
          confidence: input.confidence ?? 0,
          metadata: input.metadata ?? {},
          recipeId: input.recipeId ?? null,
        },
      });
      results.push(created);
    }
    return results;
  }

  findByJobId(jobId: string): Promise<ExtractionEvidence[]> {
    return this.db.extractionEvidence.findMany({
      where: { jobId },
      orderBy: { id: 'asc' },
    });
  }
}
