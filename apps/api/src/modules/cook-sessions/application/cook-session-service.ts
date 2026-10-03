import { Prisma, type CookSessionStatus } from '@prisma/client';

import { BadRequestError } from '../../../shared/errors/app-error.js';
import { CookSessionNotFoundError } from '../../../shared/errors/cook-session-errors.js';
import { RecipeNotFoundError } from '../../../shared/errors/recipe-errors.js';
import { buildPaginationMeta } from '../../../shared/pagination/pagination.js';
import type { IRecipeRepository } from '../../recipes/repository/recipe.repository.js';
import type { CreateCookSessionBody, ListCookSessionsQuery, PatchCookSessionBody } from '../api/cook-sessions.schema.js';
import type {
  CookSessionWithRecipe,
  ICookSessionRepository,
  StepStatUpsert,
  UpdateCookSessionInput,
} from '../repository/cook-session.repository.js';

export type CookSessionStepView = {
  stepIndex: number;
  visitCount: number;
  durationMs: number;
  firstEnteredAt: Date;
  lastEnteredAt: Date;
};

export type CookSessionView = {
  id: string;
  recipeId: string;
  status: CookSessionStatus;
  currentStepIndex: number;
  startedAt: Date;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  totalDurationMs: number;
  steps: CookSessionStepView[];
  recipe: {
    id: string;
    title: string;
    stepCount: number;
  };
};

function isEndedStatus(status: CookSessionStatus): boolean {
  return status === 'COMPLETED' || status === 'STOPPED';
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function elapsedMs(from: Date, to: Date): number {
  return Math.max(0, to.getTime() - from.getTime());
}

function toView(session: CookSessionWithRecipe, now = new Date()): CookSessionView {
  const liveMs =
    session.status === 'IN_PROGRESS' ? elapsedMs(session.currentStepEnteredAt, now) : 0;

  const steps = session.stepStats.map((stat) => {
    const durationMs =
      stat.stepIndex === session.currentStepIndex ? stat.durationMs + liveMs : stat.durationMs;
    return {
      stepIndex: stat.stepIndex,
      visitCount: stat.visitCount,
      durationMs,
      firstEnteredAt: stat.firstEnteredAt,
      lastEnteredAt: stat.lastEnteredAt,
    };
  });

  return {
    id: session.id,
    recipeId: session.recipeId,
    status: session.status,
    currentStepIndex: session.currentStepIndex,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    totalDurationMs: steps.reduce((sum, step) => sum + step.durationMs, 0),
    steps,
    recipe: {
      id: session.recipe.id,
      title: session.recipe.title,
      stepCount: session.recipe._count.steps,
    },
  };
}

function assertStepIndex(stepIndex: number, stepCount: number): void {
  const maxIndex = Math.max(stepCount - 1, 0);
  if (stepIndex < 0 || stepIndex > maxIndex) {
    throw new BadRequestError({
      message: `currentStepIndex must be between 0 and ${String(maxIndex)}`,
    });
  }
}

function findStat(
  session: CookSessionWithRecipe,
  stepIndex: number,
): CookSessionWithRecipe['stepStats'][number] | undefined {
  return session.stepStats.find((stat) => stat.stepIndex === stepIndex);
}

function toUpsert(
  stat: CookSessionWithRecipe['stepStats'][number] | undefined,
  stepIndex: number,
  now: Date,
  patch: { addDurationMs?: number; incrementVisit?: boolean },
): StepStatUpsert {
  return {
    stepIndex,
    visitCount: (stat?.visitCount ?? 0) + (patch.incrementVisit ? 1 : 0),
    durationMs: (stat?.durationMs ?? 0) + (patch.addDurationMs ?? 0),
    firstEnteredAt: stat?.firstEnteredAt ?? now,
    lastEnteredAt: now,
  };
}

export class CookSessionService {
  constructor(
    private readonly cookSessionRepo: ICookSessionRepository,
    private readonly recipeRepo: IRecipeRepository,
  ) {}

  async create(body: CreateCookSessionBody): Promise<{ session: CookSessionView; resumed: boolean }> {
    const recipe = await this.recipeRepo.findById(body.recipeId);
    if (!recipe) {
      throw new RecipeNotFoundError();
    }

    const existing = await this.cookSessionRepo.findInProgressByRecipeId(body.recipeId);
    if (existing) {
      return { session: toView(existing), resumed: true };
    }

    if (body.currentStepIndex !== undefined) {
      assertStepIndex(body.currentStepIndex, recipe.steps.length);
    }

    await this.finishOtherInProgress(body.recipeId);

    try {
      const created = await this.cookSessionRepo.create({
        recipeId: body.recipeId,
        ...(body.currentStepIndex !== undefined ? { currentStepIndex: body.currentStepIndex } : {}),
      });
      return { session: toView(created), resumed: false };
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const raced = await this.cookSessionRepo.findInProgressByRecipeId(body.recipeId);
      if (!raced) {
        throw error;
      }
      return { session: toView(raced), resumed: true };
    }
  }

  async getById(id: string): Promise<CookSessionView> {
    const session = await this.cookSessionRepo.findById(id);
    if (!session) {
      throw new CookSessionNotFoundError();
    }

    return toView(session);
  }

  async list(
    query: ListCookSessionsQuery,
  ): Promise<{ items: CookSessionView[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { items, total } = await this.cookSessionRepo.list({
      page: query.page,
      pageSize: query.pageSize,
      ...(query.status !== undefined ? { status: query.status } : {}),
    });

    return {
      items: items.map((item) => toView(item)),
      meta: buildPaginationMeta(query, total),
    };
  }

  async update(id: string, patch: PatchCookSessionBody): Promise<CookSessionView> {
    const existing = await this.cookSessionRepo.findById(id);
    if (!existing) {
      throw new CookSessionNotFoundError();
    }

    if (patch.currentStepIndex !== undefined) {
      assertStepIndex(patch.currentStepIndex, existing.recipe._count.steps);
    }

    if (isEndedStatus(existing.status) && patch.status !== 'IN_PROGRESS') {
      return toView(existing);
    }

    if (patch.status === 'IN_PROGRESS' && isEndedStatus(existing.status)) {
      await this.finishOtherInProgress(existing.recipeId);
    }

    return toView(await this.applyProgress(existing, patch));
  }

  async delete(id: string): Promise<void> {
    const existing = await this.cookSessionRepo.findById(id);
    if (!existing) {
      throw new CookSessionNotFoundError();
    }

    if (existing.status === 'COMPLETED') {
      await this.recipeRepo.adjustCompletedCookCount(existing.userId, existing.recipeId, -1);
    }
    await this.cookSessionRepo.delete(id);
  }

  private async finishOtherInProgress(exceptRecipeId: string): Promise<void> {
    const others = await this.cookSessionRepo.findManyInProgress(exceptRecipeId);
    for (const other of others) {
      await this.applyProgress(other, { status: 'STOPPED' });
    }
  }

  private async applyProgress(
    existing: CookSessionWithRecipe,
    patch: PatchCookSessionBody,
  ): Promise<CookSessionWithRecipe> {
    const now = new Date();
    const dwellMs = elapsedMs(existing.currentStepEnteredAt, now);
    const nextStepIndex = patch.currentStepIndex ?? existing.currentStepIndex;
    const stepChanged = nextStepIndex !== existing.currentStepIndex;
    const reopening = isEndedStatus(existing.status) && patch.status === 'IN_PROGRESS';
    const finishing =
      existing.status === 'IN_PROGRESS' &&
      patch.status !== undefined &&
      isEndedStatus(patch.status);

    const stepStats: StepStatUpsert[] = [
      toUpsert(findStat(existing, existing.currentStepIndex), existing.currentStepIndex, now, {
        addDurationMs: reopening ? 0 : dwellMs,
        incrementVisit: reopening && !stepChanged,
      }),
    ];

    if (stepChanged) {
      stepStats.push(
        toUpsert(findStat(existing, nextStepIndex), nextStepIndex, now, {
          incrementVisit: true,
        }),
      );
    }

    const input: UpdateCookSessionInput = {
      stepStats,
      currentStepEnteredAt: now,
      ...(stepChanged ? { currentStepIndex: nextStepIndex } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(finishing ? { finishedAt: existing.finishedAt ?? now } : {}),
      ...(reopening ? { finishedAt: null } : {}),
    };

    const updated = await this.cookSessionRepo.update(existing.id, input);
    await this.syncCompletedCookCount(
      existing.status,
      updated.status,
      existing.userId,
      existing.recipeId,
    );
    return updated;
  }

  private async syncCompletedCookCount(
    previous: CookSessionStatus,
    next: CookSessionStatus,
    userId: string,
    recipeId: string,
  ): Promise<void> {
    const wasCompleted = previous === 'COMPLETED';
    const isCompleted = next === 'COMPLETED';
    if (wasCompleted === isCompleted) {
      return;
    }
    await this.recipeRepo.adjustCompletedCookCount(userId, recipeId, isCompleted ? 1 : -1);
  }
}
