import type { Prisma, PrismaClient } from '@prisma/client';

import { thumbnailFromMetadata } from '../../../modules/recipes/application/recipe-presentation.js';
import type {
  CollectionCoverPreviewRecord,
  CollectionDetailRecord,
  CollectionMemberRecord,
  CollectionRecord,
  CreateCollectionInput,
  ICollectionRepository,
} from '../../../modules/collections/repository/collection.repository.js';

const COVER_LIMIT = 3;

const memberInclude = {
  userRecipe: {
    include: {
      recipe: { include: { recipeSource: true } },
      revisions: {
        orderBy: { revisionNumber: 'desc' as const },
        take: 1,
        include: {
          categories: { orderBy: { sortOrder: 'asc' as const } },
          _count: { select: { ingredients: true, steps: true } },
        },
      },
    },
  },
} satisfies Prisma.CollectionRecipeInclude;

type MemberRow = Prisma.CollectionRecipeGetPayload<{ include: typeof memberInclude }>;

function ratingSummary(rating: number | null): {
  ratingAverage: number | null;
  ratingCount: number;
} {
  return {
    ratingAverage: rating,
    ratingCount: rating == null ? 0 : 1,
  };
}

function toMemberRecord(row: MemberRow): CollectionMemberRecord | null {
  const revision = row.userRecipe.revisions[0];
  if (!revision) {
    return null;
  }
  const owned = row.userRecipe;
  return {
    id: owned.recipeId,
    userRecipeId: owned.id,
    title: revision.title,
    description: revision.description,
    confidence: revision.confidence,
    sourceLanguage: revision.sourceLanguage,
    createdAt: owned.createdAt,
    updatedAt: owned.updatedAt,
    servings: revision.servings,
    prepTimeMinutes: revision.prepTimeMinutes,
    cookTimeMinutes: revision.cookTimeMinutes,
    totalTimeMinutes: revision.totalTimeMinutes,
    calories: revision.calories,
    cuisine: revision.cuisine,
    isFavorite: owned.isFavorite,
    rating: owned.rating,
    cookCount: owned.completedCookCount,
    reviewState: owned.reviewState,
    ...ratingSummary(owned.rating),
    categories: revision.categories.map((category) => ({
      id: category.categoryId ?? category.id,
      slug: category.slug,
      name: category.name,
      sortOrder: category.sortOrder,
    })),
    ingredientCount: revision._count.ingredients,
    stepCount: revision._count.steps,
    recipeSource: owned.recipe.recipeSource,
    sortOrder: row.sortOrder,
  };
}

function coversFromMembers(members: CollectionMemberRecord[]): CollectionCoverPreviewRecord[] {
  return members.slice(0, COVER_LIMIT).map((member) => ({
    recipeId: member.id,
    title: member.title,
    thumbnailUrl: thumbnailFromMetadata(member.recipeSource.metadata),
  }));
}

function toDetail(
  collection: {
    id: string;
    userId: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  rows: MemberRow[],
): CollectionDetailRecord {
  const recipes = rows
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map(toMemberRecord)
    .filter((member): member is CollectionMemberRecord => member !== null);
  return {
    id: collection.id,
    userId: collection.userId,
    name: collection.name,
    description: collection.description,
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
    recipeCount: recipes.length,
    recipeIds: recipes.map((member) => member.id),
    coverPreviews: coversFromMembers(recipes),
    recipes,
  };
}

function toSummary(detail: CollectionDetailRecord): CollectionRecord {
  return {
    id: detail.id,
    userId: detail.userId,
    name: detail.name,
    description: detail.description,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    recipeCount: detail.recipeCount,
    recipeIds: detail.recipeIds,
    coverPreviews: detail.coverPreviews,
  };
}

export class PrismaCollectionRepository implements ICollectionRepository {
  constructor(private readonly db: PrismaClient) {}

  async list(params: {
    userId: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: CollectionRecord[]; total: number }> {
    const where = { userId: params.userId };
    const [rows, total] = await this.db.$transaction([
      this.db.collection.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: {
          recipes: {
            orderBy: { sortOrder: 'asc' },
            include: memberInclude,
          },
        },
      }),
      this.db.collection.count({ where }),
    ]);
    return {
      items: rows.map((row) => toSummary(toDetail(row, row.recipes))),
      total,
    };
  }

  async findById(id: string, userId: string): Promise<CollectionDetailRecord | null> {
    const row = await this.db.collection.findFirst({
      where: { id, userId },
      include: {
        recipes: {
          orderBy: { sortOrder: 'asc' },
          include: memberInclude,
        },
      },
    });
    if (!row) {
      return null;
    }
    return toDetail(row, row.recipes);
  }

  async findByName(
    userId: string,
    name: string,
    exceptId?: string,
  ): Promise<CollectionRecord | null> {
    const row = await this.db.collection.findFirst({
      where: {
        userId,
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId !== undefined ? { id: { not: exceptId } } : {}),
      },
      include: {
        recipes: {
          orderBy: { sortOrder: 'asc' },
          include: memberInclude,
        },
      },
    });
    if (!row) {
      return null;
    }
    return toSummary(toDetail(row, row.recipes));
  }

  async create(input: CreateCollectionInput): Promise<CollectionDetailRecord> {
    const row = await this.db.collection.create({
      data: {
        userId: input.userId,
        name: input.name,
        description: input.description ?? null,
        ...(input.members?.length
          ? {
              recipes: {
                create: input.members.map((member) => ({
                  userRecipeId: member.userRecipeId,
                  sortOrder: member.sortOrder,
                })),
              },
            }
          : {}),
      },
      include: {
        recipes: {
          orderBy: { sortOrder: 'asc' },
          include: memberInclude,
        },
      },
    });
    return toDetail(row, row.recipes);
  }

  async update(
    id: string,
    userId: string,
    input: { name?: string; description?: string | null },
  ): Promise<CollectionDetailRecord | null> {
    const existing = await this.db.collection.findFirst({ where: { id, userId } });
    if (!existing) {
      return null;
    }
    const row = await this.db.collection.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
      include: {
        recipes: {
          orderBy: { sortOrder: 'asc' },
          include: memberInclude,
        },
      },
    });
    return toDetail(row, row.recipes);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await this.db.collection.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }

  async addMember(
    collectionId: string,
    userId: string,
    userRecipeId: string,
    sortOrder: number,
  ): Promise<CollectionDetailRecord | null> {
    const existing = await this.db.collection.findFirst({ where: { id: collectionId, userId } });
    if (!existing) {
      return null;
    }
    await this.db.collectionRecipe.create({
      data: { collectionId, userRecipeId, sortOrder },
    });
    await this.db.collection.update({
      where: { id: collectionId },
      data: { updatedAt: new Date() },
    });
    return this.findById(collectionId, userId);
  }

  async removeMember(
    collectionId: string,
    userId: string,
    userRecipeId: string,
  ): Promise<CollectionDetailRecord | null> {
    const existing = await this.db.collection.findFirst({ where: { id: collectionId, userId } });
    if (!existing) {
      return null;
    }
    await this.db.$transaction(async (tx) => {
      await tx.collectionRecipe.delete({
        where: { collectionId_userRecipeId: { collectionId, userRecipeId } },
      });
      const remaining = await tx.collectionRecipe.findMany({
        where: { collectionId },
        orderBy: { sortOrder: 'asc' },
      });
      await Promise.all(
        remaining.map((row, index) =>
          tx.collectionRecipe.update({
            where: {
              collectionId_userRecipeId: {
                collectionId,
                userRecipeId: row.userRecipeId,
              },
            },
            data: { sortOrder: index },
          }),
        ),
      );
      await tx.collection.update({
        where: { id: collectionId },
        data: { updatedAt: new Date() },
      });
    });
    return this.findById(collectionId, userId);
  }

  async reorderMembers(
    collectionId: string,
    userId: string,
    userRecipeIds: string[],
  ): Promise<CollectionDetailRecord | null> {
    const existing = await this.db.collection.findFirst({ where: { id: collectionId, userId } });
    if (!existing) {
      return null;
    }
    await this.db.$transaction([
      ...userRecipeIds.map((userRecipeId, index) =>
        this.db.collectionRecipe.update({
          where: { collectionId_userRecipeId: { collectionId, userRecipeId } },
          data: { sortOrder: index },
        }),
      ),
      this.db.collection.update({
        where: { id: collectionId },
        data: { updatedAt: new Date() },
      }),
    ]);
    return this.findById(collectionId, userId);
  }

  findUserRecipe(
    userId: string,
    recipeId: string,
  ): Promise<{ id: string; recipeId: string } | null> {
    return this.db.userRecipe.findUnique({
      where: { userId_recipeId: { userId, recipeId } },
      select: { id: true, recipeId: true },
    });
  }

  listUserRecipes(
    userId: string,
    recipeIds: string[],
  ): Promise<Array<{ id: string; recipeId: string }>> {
    if (recipeIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.db.userRecipe.findMany({
      where: { userId, recipeId: { in: recipeIds } },
      select: { id: true, recipeId: true },
    });
  }

  async maxSortOrder(collectionId: string): Promise<number> {
    const result = await this.db.collectionRecipe.aggregate({
      where: { collectionId },
      _max: { sortOrder: true },
    });
    return result._max.sortOrder ?? -1;
  }
}
