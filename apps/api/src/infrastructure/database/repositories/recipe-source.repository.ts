import type { Prisma, PrismaClient, RecipeSource } from '@prisma/client';

import type {
  CreateRecipeSourceInput,
  IRecipeSourceRepository,
} from '../../../modules/recipes/repository/recipe-source.repository.js';

export class PrismaRecipeSourceRepository implements IRecipeSourceRepository {
  constructor(private readonly db: PrismaClient) {}

  create(input: CreateRecipeSourceInput): Promise<RecipeSource> {
    return this.db.recipeSource.create({
      data: {
        sourceType: input.sourceType,
        originalUrl: input.originalUrl,
        normalizedUrl: input.normalizedUrl,
        urlHash: input.urlHash,
        metadata: input.metadata ?? {},
      },
    });
  }

  findByUrlHash(urlHash: string): Promise<RecipeSource | null> {
    return this.db.recipeSource.findUnique({ where: { urlHash } });
  }

  findById(id: string): Promise<RecipeSource | null> {
    return this.db.recipeSource.findUnique({ where: { id } });
  }

  async updateMetadata(id: string, metadata: Prisma.InputJsonValue): Promise<RecipeSource> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Recipe source not found: ${id}`);
    }

    const existingMeta =
      existing.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata)
        ? (existing.metadata as Record<string, unknown>)
        : {};
    const incomingMeta =
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {};

    return this.db.recipeSource.update({
      where: { id },
      data: {
        metadata: { ...existingMeta, ...incomingMeta } as Prisma.InputJsonValue,
      },
    });
  }
}
