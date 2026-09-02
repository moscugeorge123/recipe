import { Prisma, type Category, type PrismaClient, type SourceType } from '@prisma/client';

import type {
  EffectiveRecipeRecord,
  CreateRecipeInput,
  IRecipeRepository,
  RecipeEngagementRecord,
  RecipeNoteRecord,
  RecipeRevisionSummary,
  RevisionSnapshotInput,
  RecipeListRecord,
  RecipeListSort,
  RecipeWithDetails,
} from '../../../modules/recipes/repository/recipe.repository.js';
import {
  summarizeRevision,
  toRevisionSummarySnapshot,
} from '../../../modules/recipes/application/revision-summary.js';
import { DEFAULT_PROFILE_ID } from '../../../modules/profiles/domain/profile.js';

const revisionInclude = {
  ingredients: { orderBy: { sortOrder: 'asc' as const } },
  steps: { orderBy: { stepOrder: 'asc' as const } },
  categories: { orderBy: { sortOrder: 'asc' as const } },
  nutritionSnapshots: { orderBy: { createdAt: 'desc' as const }, take: 1 },
} satisfies Prisma.RecipeRevisionInclude;

type RevisionWithSnapshot = Prisma.RecipeRevisionGetPayload<{ include: typeof revisionInclude }>;
type OwnedRecipe = Prisma.UserRecipeGetPayload<{
  include: { recipe: { include: { recipeSource: true } } };
}>;

function changeSummary(
  revision: RevisionWithSnapshot,
  previous: RevisionWithSnapshot | undefined,
): string[] {
  return summarizeRevision(
    toRevisionSummarySnapshot(revision),
    previous ? toRevisionSummarySnapshot(previous) : undefined,
  );
}

function toNullableJson(
  value: Prisma.InputJsonValue | null,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === null ? Prisma.DbNull : value;
}

function isRevisionRace(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2002' || error.code === 'P2034')
  );
}

function ratingSummary(rating: number | null): {
  ratingAverage: number | null;
  ratingCount: number;
} {
  return {
    ratingAverage: rating,
    ratingCount: rating == null ? 0 : 1,
  };
}

function sameInstant(left: Date, right: Date): boolean {
  return left.getTime() === right.getTime();
}

function toEngagement(owned: {
  recipeId: string;
  id: string;
  isFavorite: boolean;
  rating: number | null;
  completedCookCount: number;
  reviewState: RecipeEngagementRecord['reviewState'];
  updatedAt: Date;
}): RecipeEngagementRecord {
  return {
    id: owned.recipeId,
    userRecipeId: owned.id,
    isFavorite: owned.isFavorite,
    rating: owned.rating,
    cookCount: owned.completedCookCount,
    reviewState: owned.reviewState,
    updatedAt: owned.updatedAt,
    ...ratingSummary(owned.rating),
  };
}

function toNoteRecord(
  note: {
    id: string;
    body: string;
    cookSessionId: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  recipeId: string,
): RecipeNoteRecord {
  return {
    id: note.id,
    recipeId,
    body: note.body,
    cookSessionId: note.cookSessionId,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

function buildListWhere(params: {
  userId: string;
  q?: string;
  cuisine?: string;
  sourceType?: SourceType;
}): Prisma.UserRecipeWhereInput {
  const and: Prisma.UserRecipeWhereInput[] = [{ userId: params.userId }];

  if (params.q) {
    and.push({
      OR: [
        { revisions: { some: { title: { contains: params.q, mode: 'insensitive' } } } },
        { revisions: { some: { description: { contains: params.q, mode: 'insensitive' } } } },
        { revisions: { some: { cuisine: { contains: params.q, mode: 'insensitive' } } } },
      ],
    });
  }

  if (params.cuisine) {
    and.push({
      revisions: { some: { cuisine: { equals: params.cuisine, mode: 'insensitive' } } },
    });
  }

  if (params.sourceType) {
    and.push({
      recipe: { recipeSource: { sourceType: params.sourceType } },
    });
  }

  return { AND: and };
}

function listOrderBy(sort: RecipeListSort): Prisma.UserRecipeOrderByWithRelationInput[] {
  if (sort === 'engagement') {
    return [
      { isFavorite: 'desc' },
      { completedCookCount: 'desc' },
      { updatedAt: 'desc' },
      { id: 'asc' },
    ];
  }
  return [{ createdAt: 'desc' }, { id: 'asc' }];
}

export class PrismaRecipeRepository implements IRecipeRepository {
  constructor(
    private readonly db: PrismaClient,
    private readonly ownerUserId: string = DEFAULT_PROFILE_ID,
  ) {}

  async create(input: CreateRecipeInput): Promise<RecipeWithDetails> {
    return this.db.$transaction(async (tx) => {
      const requestedSlugs = [...new Set(input.categorySlugs ?? ['dinner'])];
      const categories = await tx.category.findMany({
        where: { userId: this.ownerUserId, slug: { in: requestedSlugs } },
        orderBy: { sortOrder: 'asc' },
      });
      if (categories.length === 0) {
        const dinner = await tx.category.findUnique({
          where: { userId_slug: { userId: this.ownerUserId, slug: 'dinner' } },
        });
        if (dinner) categories.push(dinner);
      }

      return tx.recipe.create({
        data: {
          recipeSourceId: input.recipeSourceId,
          title: input.title,
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.servings !== undefined ? { servings: input.servings } : {}),
          ...(input.prepTimeMinutes !== undefined
            ? { prepTimeMinutes: input.prepTimeMinutes }
            : {}),
          ...(input.cookTimeMinutes !== undefined
            ? { cookTimeMinutes: input.cookTimeMinutes }
            : {}),
          ...(input.totalTimeMinutes !== undefined
            ? { totalTimeMinutes: input.totalTimeMinutes }
            : {}),
          ...(input.calories !== undefined ? { calories: input.calories } : {}),
          ...(input.cuisine !== undefined ? { cuisine: input.cuisine } : {}),
          ...(input.nutrition !== undefined ? { nutrition: toNullableJson(input.nutrition) } : {}),
          ...(input.sourceLanguage !== undefined ? { sourceLanguage: input.sourceLanguage } : {}),
          confidence: input.confidence ?? 0,
          warnings: input.warnings ?? [],
          ...(input.promptVersion !== undefined ? { promptVersion: input.promptVersion } : {}),
          ...(input.rawExtraction !== undefined ? { rawExtraction: input.rawExtraction } : {}),
          ingredients: {
            create: input.ingredients,
          },
          steps: {
            create: input.steps,
          },
          users: {
            create: {
              userId: this.ownerUserId,
              reviewState: input.reviewState ?? 'NEEDS_REVIEW',
              categoryLinks: {
                create: categories.map((category) => ({
                  category: {
                    connect: {
                      id_userId: { id: category.id, userId: this.ownerUserId },
                    },
                  },
                })),
              },
              revisions: {
                create: {
                  authorUserId: this.ownerUserId,
                  revisionNumber: 0,
                  source: 'IMPORT',
                  title: input.title,
                  ...(input.description !== undefined ? { description: input.description } : {}),
                  ...(input.servings !== undefined ? { servings: input.servings } : {}),
                  ...(input.prepTimeMinutes !== undefined
                    ? { prepTimeMinutes: input.prepTimeMinutes }
                    : {}),
                  ...(input.cookTimeMinutes !== undefined
                    ? { cookTimeMinutes: input.cookTimeMinutes }
                    : {}),
                  ...(input.totalTimeMinutes !== undefined
                    ? { totalTimeMinutes: input.totalTimeMinutes }
                    : {}),
                  ...(input.calories !== undefined ? { calories: input.calories } : {}),
                  ...(input.cuisine !== undefined ? { cuisine: input.cuisine } : {}),
                  ...(input.nutrition !== undefined
                    ? { nutrition: toNullableJson(input.nutrition) }
                    : {}),
                  ...(input.sourceLanguage !== undefined
                    ? { sourceLanguage: input.sourceLanguage }
                    : {}),
                  confidence: input.confidence ?? 0,
                  warnings: input.warnings ?? [],
                  ...(input.promptVersion !== undefined
                    ? { promptVersion: input.promptVersion }
                    : {}),
                  ...(input.rawExtraction !== undefined
                    ? { rawExtraction: input.rawExtraction }
                    : {}),
                  ingredients: { create: input.ingredients },
                  steps: { create: input.steps },
                  categories: {
                    create: categories.map((category) => ({
                      categoryId: category.id,
                      slug: category.slug,
                      name: category.name,
                      sortOrder: category.sortOrder,
                    })),
                  },
                },
              },
            },
          },
        },
        include: {
          ingredients: { orderBy: { sortOrder: 'asc' } },
          steps: { orderBy: { stepOrder: 'asc' } },
        },
      });
    });
  }

  findById(id: string): Promise<RecipeWithDetails | null> {
    return this.db.recipe.findUnique({
      where: { id },
      include: {
        ingredients: { orderBy: { sortOrder: 'asc' } },
        steps: { orderBy: { stepOrder: 'asc' } },
      },
    });
  }

  findBySourceId(recipeSourceId: string): Promise<RecipeWithDetails | null> {
    return this.db.recipe.findUnique({
      where: { recipeSourceId },
      include: {
        ingredients: { orderBy: { sortOrder: 'asc' } },
        steps: { orderBy: { stepOrder: 'asc' } },
      },
    });
  }

  async findEffectiveById(id: string, userId: string): Promise<EffectiveRecipeRecord | null> {
    const owned = await this.db.userRecipe.findUnique({
      where: { userId_recipeId: { userId, recipeId: id } },
      include: {
        recipe: { include: { recipeSource: true } },
        revisions: { orderBy: { revisionNumber: 'desc' }, take: 1, include: revisionInclude },
      },
    });
    const revision = owned?.revisions[0];
    if (!owned || !revision) return null;
    return this.toEffective(owned, revision);
  }

  async setFavorite(
    id: string,
    userId: string,
    isFavorite: boolean,
    expectedUpdatedAt?: Date,
  ): Promise<RecipeEngagementRecord | 'conflict' | null> {
    return this.updateEngagement(id, userId, { isFavorite }, expectedUpdatedAt);
  }

  async setRating(
    id: string,
    userId: string,
    rating: number | null,
    expectedUpdatedAt?: Date,
  ): Promise<RecipeEngagementRecord | 'conflict' | null> {
    return this.updateEngagement(id, userId, { rating }, expectedUpdatedAt);
  }

  async setReviewState(
    id: string,
    userId: string,
    reviewState: RecipeEngagementRecord['reviewState'],
    expectedUpdatedAt?: Date,
  ): Promise<RecipeEngagementRecord | 'conflict' | null> {
    return this.updateEngagement(id, userId, { reviewState }, expectedUpdatedAt);
  }

  async adjustCompletedCookCount(userId: string, recipeId: string, delta: number): Promise<void> {
    if (delta === 0) {
      return;
    }
    if (delta > 0) {
      await this.db.userRecipe.updateMany({
        where: { userId, recipeId },
        data: { completedCookCount: { increment: delta } },
      });
      return;
    }
    await this.db.userRecipe.updateMany({
      where: {
        userId,
        recipeId,
        completedCookCount: { gte: Math.abs(delta) },
      },
      data: { completedCookCount: { increment: delta } },
    });
  }

  async listNotes(id: string, userId: string): Promise<RecipeNoteRecord[] | null> {
    const owned = await this.db.userRecipe.findUnique({
      where: { userId_recipeId: { userId, recipeId: id } },
      include: { notes: { orderBy: { createdAt: 'desc' } } },
    });
    if (!owned) return null;
    return owned.notes.map((note) => toNoteRecord(note, id));
  }

  async createNote(
    id: string,
    userId: string,
    input: { body: string; cookSessionId?: string | null },
  ): Promise<RecipeNoteRecord | 'invalid-session' | null> {
    const owned = await this.db.userRecipe.findUnique({
      where: { userId_recipeId: { userId, recipeId: id } },
    });
    if (!owned) return null;
    const sessionCheck = await this.assertCookSession(userId, id, input.cookSessionId);
    if (!sessionCheck) return 'invalid-session';
    const note = await this.db.recipeNote.create({
      data: {
        userRecipeId: owned.id,
        body: input.body,
        ...(input.cookSessionId !== undefined ? { cookSessionId: input.cookSessionId } : {}),
      },
    });
    return toNoteRecord(note, id);
  }

  async updateNote(
    id: string,
    noteId: string,
    userId: string,
    input: { body?: string; cookSessionId?: string | null },
  ): Promise<RecipeNoteRecord | 'invalid-session' | null> {
    const existing = await this.db.recipeNote.findFirst({
      where: { id: noteId, userRecipe: { userId, recipeId: id } },
    });
    if (!existing) return null;
    const sessionCheck = await this.assertCookSession(userId, id, input.cookSessionId);
    if (!sessionCheck) return 'invalid-session';
    const note = await this.db.recipeNote.update({
      where: { id: noteId },
      data: {
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.cookSessionId !== undefined ? { cookSessionId: input.cookSessionId } : {}),
      },
    });
    return toNoteRecord(note, id);
  }

  async deleteNote(id: string, noteId: string, userId: string): Promise<boolean> {
    const result = await this.db.recipeNote.deleteMany({
      where: { id: noteId, userRecipe: { userId, recipeId: id } },
    });
    return result.count > 0;
  }

  private async updateEngagement(
    id: string,
    userId: string,
    patch: {
      isFavorite?: boolean;
      rating?: number | null;
      reviewState?: RecipeEngagementRecord['reviewState'];
    },
    expectedUpdatedAt?: Date,
  ): Promise<RecipeEngagementRecord | 'conflict' | null> {
    const owned = await this.db.userRecipe.findUnique({
      where: { userId_recipeId: { userId, recipeId: id } },
    });
    if (!owned) return null;

    const alreadyMatches =
      (patch.isFavorite === undefined || owned.isFavorite === patch.isFavorite) &&
      (patch.rating === undefined || owned.rating === patch.rating) &&
      (patch.reviewState === undefined || owned.reviewState === patch.reviewState);
    if (alreadyMatches) {
      return toEngagement(owned);
    }
    if (expectedUpdatedAt && !sameInstant(owned.updatedAt, expectedUpdatedAt)) {
      return 'conflict';
    }

    const result = await this.db.userRecipe.updateMany({
      where: {
        id: owned.id,
        ...(expectedUpdatedAt ? { updatedAt: expectedUpdatedAt } : {}),
      },
      data: {
        ...(patch.isFavorite !== undefined ? { isFavorite: patch.isFavorite } : {}),
        ...(patch.rating !== undefined ? { rating: patch.rating } : {}),
        ...(patch.reviewState !== undefined ? { reviewState: patch.reviewState } : {}),
      },
    });
    if (result.count === 0) {
      const again = await this.db.userRecipe.findUnique({
        where: { userId_recipeId: { userId, recipeId: id } },
      });
      if (!again) return null;
      const nowMatches =
        (patch.isFavorite === undefined || again.isFavorite === patch.isFavorite) &&
        (patch.rating === undefined || again.rating === patch.rating) &&
        (patch.reviewState === undefined || again.reviewState === patch.reviewState);
      return nowMatches ? toEngagement(again) : 'conflict';
    }

    const updated = await this.db.userRecipe.findUniqueOrThrow({
      where: { id: owned.id },
    });
    return toEngagement(updated);
  }

  private async assertCookSession(
    userId: string,
    recipeId: string,
    cookSessionId: string | null | undefined,
  ): Promise<boolean> {
    if (cookSessionId === undefined || cookSessionId === null) {
      return true;
    }
    const session = await this.db.cookSession.findFirst({
      where: { id: cookSessionId, userId, recipeId },
      select: { id: true },
    });
    return session !== null;
  }

  async appendRevision(
    id: string,
    userId: string,
    expectedRevisionNumber: number,
    input: RevisionSnapshotInput,
  ): Promise<EffectiveRecipeRecord | 'conflict' | 'invalid-categories' | null> {
    try {
      const result = await this.db.$transaction(
        async (tx) => {
          const owned = await tx.userRecipe.findUnique({
            where: { userId_recipeId: { userId, recipeId: id } },
            include: {
              recipe: { include: { recipeSource: true } },
              revisions: { orderBy: { revisionNumber: 'desc' }, take: 1, include: revisionInclude },
            },
          });
          const head = owned?.revisions[0];
          if (!owned || !head) return null;
          if (head.revisionNumber !== expectedRevisionNumber) return 'conflict' as const;

          const uniqueCategoryIds = [...new Set(input.categoryIds)];
          const categories = await tx.category.findMany({
            where: { userId, id: { in: uniqueCategoryIds } },
            orderBy: { sortOrder: 'asc' },
          });
          if (categories.length !== uniqueCategoryIds.length) return 'invalid-categories' as const;

          const revision = await tx.recipeRevision.create({
            data: {
              userRecipeId: owned.id,
              authorUserId: userId,
              revisionNumber: head.revisionNumber + 1,
              source: 'USER_EDIT',
              title: input.title,
              description: input.description,
              servings: input.servings,
              prepTimeMinutes: input.prepTimeMinutes,
              cookTimeMinutes: input.cookTimeMinutes,
              totalTimeMinutes: input.totalTimeMinutes,
              calories: input.calories,
              cuisine: input.cuisine,
              nutrition:
                head.nutrition === null ? Prisma.DbNull : (head.nutrition as Prisma.InputJsonValue),
              sourceLanguage: head.sourceLanguage,
              confidence: head.confidence,
              warnings: head.warnings as Prisma.InputJsonValue,
              promptVersion: head.promptVersion,
              ...(head.rawExtraction !== null ? { rawExtraction: head.rawExtraction } : {}),
              ingredients: {
                create: input.ingredients.map((ingredient) => ({
                  ...ingredient,
                  confidence: 1,
                  provenance: { source: 'user' },
                  warnings: [],
                })),
              },
              steps: {
                create: input.steps.map((step) => ({
                  ...step,
                  confidence: 1,
                  provenance: { source: 'user' },
                  warnings: [],
                })),
              },
              categories: {
                create: categories.map((category) => ({
                  categoryId: category.id,
                  slug: category.slug,
                  name: category.name,
                  sortOrder: category.sortOrder,
                })),
              },
            },
            include: revisionInclude,
          });

          await tx.recipeCategory.deleteMany({ where: { userRecipeId: owned.id } });
          if (categories.length > 0) {
            await tx.recipeCategory.createMany({
              data: categories.map((category) => ({
                userRecipeId: owned.id,
                categoryId: category.id,
                userId,
              })),
            });
          }
          await tx.userRecipe.update({
            where: { id: owned.id },
            data: { reviewState: 'READY' },
          });
          return {
            owned: { ...owned, reviewState: 'READY' as const },
            revision,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      if (result === null || result === 'conflict' || result === 'invalid-categories')
        return result;
      return this.toEffective(result.owned, result.revision);
    } catch (error) {
      if (isRevisionRace(error)) {
        return 'conflict';
      }
      throw error;
    }
  }

  async listRevisions(id: string, userId: string): Promise<RecipeRevisionSummary[] | null> {
    const owned = await this.db.userRecipe.findUnique({
      where: { userId_recipeId: { userId, recipeId: id } },
      include: { revisions: { orderBy: { revisionNumber: 'asc' }, include: revisionInclude } },
    });
    if (!owned) return null;
    return owned.revisions
      .map((revision, index, revisions) => {
        const changes = changeSummary(revision, revisions[index - 1]);
        return {
          id: revision.id,
          revisionNumber: revision.revisionNumber,
          source: revision.source,
          createdAt: revision.createdAt,
          title: revision.title,
          isOriginal: revision.revisionNumber === 0,
          summary: changes.join(' · '),
          changes,
        };
      })
      .reverse();
  }

  async findRevision(
    id: string,
    revisionId: string,
    userId: string,
  ): Promise<EffectiveRecipeRecord | null> {
    const revision = await this.db.recipeRevision.findFirst({
      where: { id: revisionId, userRecipe: { userId, recipeId: id } },
      include: {
        ...revisionInclude,
        userRecipe: { include: { recipe: { include: { recipeSource: true } } } },
      },
    });
    if (!revision) return null;
    return this.toEffective(revision.userRecipe, revision);
  }

  async restoreRevision(
    id: string,
    revisionId: string,
    userId: string,
    expectedRevisionNumber: number,
  ): Promise<EffectiveRecipeRecord | 'conflict' | null> {
    try {
      const result = await this.db.$transaction(
        async (tx) => {
          const owned = await tx.userRecipe.findUnique({
            where: { userId_recipeId: { userId, recipeId: id } },
            include: {
              recipe: { include: { recipeSource: true } },
              revisions: { orderBy: { revisionNumber: 'desc' }, take: 1, include: revisionInclude },
            },
          });
          const head = owned?.revisions[0];
          if (!owned || !head) return null;
          if (head.revisionNumber !== expectedRevisionNumber) return 'conflict' as const;
          const target = await tx.recipeRevision.findFirst({
            where: { id: revisionId, userRecipeId: owned.id },
            include: revisionInclude,
          });
          if (!target) return null;

          const currentCategories: Category[] = [];
          for (const snapshot of target.categories) {
            const category = await tx.category.upsert({
              where: { userId_slug: { userId, slug: snapshot.slug } },
              create: {
                userId,
                slug: snapshot.slug,
                name: snapshot.name,
                sortOrder: snapshot.sortOrder,
              },
              update: {},
            });
            currentCategories.push(category);
          }

          const revision = await tx.recipeRevision.create({
            data: {
              userRecipeId: owned.id,
              authorUserId: userId,
              revisionNumber: head.revisionNumber + 1,
              source: 'RESTORE',
              title: target.title,
              description: target.description,
              servings: target.servings,
              prepTimeMinutes: target.prepTimeMinutes,
              cookTimeMinutes: target.cookTimeMinutes,
              totalTimeMinutes: target.totalTimeMinutes,
              calories: target.calories,
              cuisine: target.cuisine,
              nutrition:
                target.nutrition === null
                  ? Prisma.DbNull
                  : (target.nutrition as Prisma.InputJsonValue),
              sourceLanguage: target.sourceLanguage,
              confidence: target.confidence,
              warnings: target.warnings as Prisma.InputJsonValue,
              promptVersion: target.promptVersion,
              ...(target.rawExtraction !== null ? { rawExtraction: target.rawExtraction } : {}),
              ingredients: {
                create: target.ingredients.map((item) => ({
                  name: item.name,
                  canonicalName: item.canonicalName,
                  quantity: item.quantity,
                  unit: item.unit,
                  preparation: item.preparation,
                  optional: item.optional,
                  emoji: item.emoji,
                  colorToken: item.colorToken,
                  category: item.category,
                  confidence: item.confidence,
                  provenance: item.provenance as Prisma.InputJsonValue,
                  warnings: item.warnings as Prisma.InputJsonValue,
                  sortOrder: item.sortOrder,
                  sourceId: item.sourceId,
                })),
              },
              steps: {
                create: target.steps.map((item) => ({
                  stepOrder: item.stepOrder,
                  instruction: item.instruction,
                  durationMinutes: item.durationMinutes,
                  temperature: item.temperature,
                  stage: item.stage,
                  confidence: item.confidence,
                  provenance: item.provenance as Prisma.InputJsonValue,
                  warnings: item.warnings as Prisma.InputJsonValue,
                  sourceId: item.sourceId,
                })),
              },
              categories: {
                create: target.categories.map((snapshot) => ({
                  categoryId:
                    currentCategories.find((item) => item.slug === snapshot.slug)?.id ?? null,
                  slug: snapshot.slug,
                  name: snapshot.name,
                  sortOrder: snapshot.sortOrder,
                })),
              },
            },
            include: revisionInclude,
          });
          await tx.recipeCategory.deleteMany({ where: { userRecipeId: owned.id } });
          if (currentCategories.length > 0) {
            await tx.recipeCategory.createMany({
              data: currentCategories.map((category) => ({
                userRecipeId: owned.id,
                categoryId: category.id,
                userId,
              })),
            });
          }
          await tx.userRecipe.update({ where: { id: owned.id }, data: { reviewState: 'READY' } });
          return {
            owned: { ...owned, reviewState: 'READY' as const },
            revision,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      if (result === null || result === 'conflict') return result;
      return this.toEffective(result.owned, result.revision);
    } catch (error) {
      if (isRevisionRace(error)) {
        return 'conflict';
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await this.db.recipe.delete({ where: { id } });
  }

  async list(params: {
    page: number;
    pageSize: number;
    userId?: string;
    q?: string;
    cuisine?: string;
    sourceType?: SourceType;
    sort?: RecipeListSort;
  }): Promise<{
    items: RecipeListRecord[];
    total: number;
  }> {
    const skip = (params.page - 1) * params.pageSize;
    const userId = params.userId ?? this.ownerUserId;
    const where = buildListWhere({
      ...params,
      userId,
    });
    const sort = params.sort ?? 'latest';

    const [rows, total] = await Promise.all([
      this.db.userRecipe.findMany({
        where,
        skip,
        take: params.pageSize,
        orderBy: listOrderBy(sort),
        include: {
          recipe: { include: { recipeSource: true } },
          revisions: {
            orderBy: { revisionNumber: 'desc' },
            take: 1,
            include: {
              categories: { orderBy: { sortOrder: 'asc' } },
              _count: { select: { ingredients: true, steps: true } },
            },
          },
        },
      }),
      this.db.userRecipe.count({ where }),
    ]);

    const items: RecipeListRecord[] = [];
    for (const owned of rows) {
      const revision = owned.revisions[0];
      if (!revision) continue;
      items.push({
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
      });
    }

    return { items, total };
  }

  async update(
    id: string,
    input: Partial<Omit<CreateRecipeInput, 'recipeSourceId'>>,
  ): Promise<RecipeWithDetails> {
    const { ingredients, steps, nutrition, ...rest } = input;
    const scalarFields = {
      ...rest,
      ...(nutrition !== undefined ? { nutrition: toNullableJson(nutrition) } : {}),
    };

    if (ingredients || steps) {
      await this.db.$transaction(async (tx) => {
        if (ingredients) {
          await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
          await tx.recipeIngredient.createMany({
            data: ingredients.map((ing) => ({ ...ing, recipeId: id })),
          });
        }
        if (steps) {
          await tx.recipeStep.deleteMany({ where: { recipeId: id } });
          await tx.recipeStep.createMany({
            data: steps.map((step) => ({ ...step, recipeId: id })),
          });
        }
        await tx.recipe.update({
          where: { id },
          data: scalarFields,
        });
      });
    } else {
      await this.db.recipe.update({ where: { id }, data: scalarFields });
    }

    const result = await this.findById(id);
    if (!result) {
      throw new Error('Recipe not found after update');
    }
    return result;
  }

  private toEffective(owned: OwnedRecipe, revision: RevisionWithSnapshot): EffectiveRecipeRecord {
    const latestNutrition = revision.nutritionSnapshots[0];
    return {
      id: owned.recipeId,
      userRecipeId: owned.id,
      revisionId: revision.id,
      revisionNumber: revision.revisionNumber,
      revisionSource: revision.source,
      reviewState: owned.reviewState,
      rating: owned.rating,
      isFavorite: owned.isFavorite,
      cookCount: owned.completedCookCount,
      nutritionStatus: latestNutrition?.status ?? 'NOT_REQUESTED',
      title: revision.title,
      description: revision.description,
      servings: revision.servings,
      prepTimeMinutes: revision.prepTimeMinutes,
      cookTimeMinutes: revision.cookTimeMinutes,
      totalTimeMinutes: revision.totalTimeMinutes,
      calories: revision.calories,
      cuisine: revision.cuisine,
      nutrition: revision.nutrition,
      sourceLanguage: revision.sourceLanguage,
      confidence: revision.confidence,
      warnings: revision.warnings,
      promptVersion: revision.promptVersion,
      ingredients: revision.ingredients.map((ingredient) => ({
        id: ingredient.id,
        name: ingredient.name,
        canonicalName: ingredient.canonicalName,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        preparation: ingredient.preparation,
        optional: ingredient.optional,
        emoji: ingredient.emoji,
        colorToken: ingredient.colorToken,
        category: ingredient.category,
        confidence: ingredient.confidence,
        provenance: ingredient.provenance,
        warnings: ingredient.warnings,
        sortOrder: ingredient.sortOrder,
      })),
      steps: revision.steps.map((step) => ({
        id: step.id,
        stepOrder: step.stepOrder,
        instruction: step.instruction,
        durationMinutes: step.durationMinutes,
        temperature: step.temperature,
        stage: step.stage,
        confidence: step.confidence,
        provenance: step.provenance,
        warnings: step.warnings,
      })),
      categories: revision.categories.map((category) => ({
        id: category.categoryId ?? category.id,
        slug: category.slug,
        name: category.name,
        sortOrder: category.sortOrder,
      })),
      source: owned.recipe.recipeSource,
      createdAt: owned.createdAt,
      updatedAt: revision.createdAt,
    };
  }
}
