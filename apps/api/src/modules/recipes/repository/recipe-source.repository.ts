import type { Prisma, RecipeSource, SourceType } from '@prisma/client';

export interface CreateRecipeSourceInput {
  sourceType: SourceType;
  originalUrl: string;
  normalizedUrl: string;
  urlHash: string;
  metadata?: Prisma.InputJsonValue;
}

export interface IRecipeSourceRepository {
  create(input: CreateRecipeSourceInput): Promise<RecipeSource>;
  findByUrlHash(urlHash: string): Promise<RecipeSource | null>;
  findById(id: string): Promise<RecipeSource | null>;
  updateMetadata(id: string, metadata: Prisma.InputJsonValue): Promise<RecipeSource>;
}
