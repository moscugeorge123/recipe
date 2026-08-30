import type { CookSessionStatus, PrismaClient } from '@prisma/client';

import type {
  CreateCookSessionInput,
  ICookSessionRepository,
  CookSessionWithRecipe,
  UpdateCookSessionInput,
} from '../../../modules/cook-sessions/repository/cook-session.repository.js';

const sessionInclude = {
  recipe: {
    select: {
      id: true,
      title: true,
      _count: { select: { steps: true } },
    },
  },
  stepStats: { orderBy: { stepIndex: 'asc' as const } },
};

export class PrismaCookSessionRepository implements ICookSessionRepository {
  constructor(private readonly db: PrismaClient) {}

  create(input: CreateCookSessionInput): Promise<CookSessionWithRecipe> {
    const stepIndex = input.currentStepIndex ?? 0;
    const now = new Date();

    return this.db.cookSession.create({
      data: {
        recipeId: input.recipeId,
        currentStepIndex: stepIndex,
        currentStepEnteredAt: now,
        stepStats: {
          create: {
            stepIndex,
            visitCount: 1,
            durationMs: 0,
            firstEnteredAt: now,
            lastEnteredAt: now,
          },
        },
      },
      include: sessionInclude,
    });
  }

  findById(id: string): Promise<CookSessionWithRecipe | null> {
    return this.db.cookSession.findUnique({
      where: { id },
      include: sessionInclude,
    });
  }

  findInProgressByRecipeId(recipeId: string): Promise<CookSessionWithRecipe | null> {
    return this.db.cookSession.findFirst({
      where: { recipeId, status: 'IN_PROGRESS' },
      include: sessionInclude,
    });
  }

  findManyInProgress(exceptRecipeId?: string): Promise<CookSessionWithRecipe[]> {
    return this.db.cookSession.findMany({
      where: {
        status: 'IN_PROGRESS',
        ...(exceptRecipeId ? { recipeId: { not: exceptRecipeId } } : {}),
      },
      include: sessionInclude,
    });
  }

  async list(params: {
    page: number;
    pageSize: number;
    status?: CookSessionStatus;
  }): Promise<{ items: CookSessionWithRecipe[]; total: number }> {
    const where = params.status ? { status: params.status } : {};
    const skip = (params.page - 1) * params.pageSize;

    const [items, total] = await Promise.all([
      this.db.cookSession.findMany({
        where,
        skip,
        take: params.pageSize,
        orderBy: { updatedAt: 'desc' },
        include: sessionInclude,
      }),
      this.db.cookSession.count({ where }),
    ]);

    return { items, total };
  }

  update(id: string, input: UpdateCookSessionInput): Promise<CookSessionWithRecipe> {
    return this.db.cookSession.update({
      where: { id },
      data: {
        ...(input.currentStepIndex !== undefined
          ? { currentStepIndex: input.currentStepIndex }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.finishedAt !== undefined ? { finishedAt: input.finishedAt } : {}),
        ...(input.currentStepEnteredAt !== undefined
          ? { currentStepEnteredAt: input.currentStepEnteredAt }
          : {}),
        ...(input.stepStats
          ? {
              stepStats: {
                upsert: input.stepStats.map((stat) => ({
                  where: { sessionId_stepIndex: { sessionId: id, stepIndex: stat.stepIndex } },
                  create: {
                    stepIndex: stat.stepIndex,
                    visitCount: stat.visitCount,
                    durationMs: stat.durationMs,
                    firstEnteredAt: stat.firstEnteredAt,
                    lastEnteredAt: stat.lastEnteredAt,
                  },
                  update: {
                    visitCount: stat.visitCount,
                    durationMs: stat.durationMs,
                    lastEnteredAt: stat.lastEnteredAt,
                  },
                })),
              },
            }
          : {}),
      },
      include: sessionInclude,
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.cookSession.delete({ where: { id } });
  }
}
