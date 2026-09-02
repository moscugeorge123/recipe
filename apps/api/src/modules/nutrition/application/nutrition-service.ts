import { toNutritionUxStatus, type NutritionUxStatus, type NutritionValues } from '@recipe/contracts';

import { silentLogger, type AppLogger } from '../../../infrastructure/logging/logger.js';
import type { QueueProvider } from '../../../infrastructure/queues/bullmq/queue-provider.js';
import type {
  INutritionRepository,
  NutritionSnapshotRecord,
} from '../../../infrastructure/database/repositories/nutrition.repository.js';
import { RecipeNotFoundError } from '../../../shared/errors/recipe-errors.js';
import { NutritionRateLimitError } from '../domain/types.js';
import type { IRecipeRepository } from '../../recipes/repository/recipe.repository.js';
import { normalizeNutritionQuery, type NutritionCalculator } from './nutrition-calculator.js';

export const NUTRITION_JOB_NAME = 'nutrition.calculate';

export interface NutritionScheduler {
  requestForRevision(input: {
    recipeId: string;
    revisionId: string;
    userId: string;
  }): Promise<void>;
  requestForRecipe(recipeId: string, userId: string): Promise<void>;
}

export interface NutritionView {
  recipeId: string;
  revisionId: string;
  snapshotId: string | null;
  status: NutritionUxStatus;
  calculationStatus: string | null;
  updating: boolean;
  provider: string | null;
  calculatedAt: string | null;
  servings: number | null;
  coverage: { matched: number; total: number; percent: number };
  unmatchedIngredients: string[];
  totals: NutritionValues | null;
  perPortion: NutritionValues | null;
  per100g: NutritionValues | null;
  matches: NutritionSnapshotRecord['matches'];
  failureReason: string | null;
}

export interface CorrectFoodMatchInput {
  ingredientId: string;
  fdcId: string;
}

export class NutritionService implements NutritionScheduler {
  constructor(
    private readonly recipeRepo: IRecipeRepository,
    private readonly nutritionRepo: INutritionRepository,
    private readonly calculator: NutritionCalculator,
    private readonly queue: QueueProvider,
    private readonly log: AppLogger = silentLogger(),
  ) {}

  async getForRecipe(recipeId: string, userId: string): Promise<NutritionView> {
    const recipe = await this.recipeRepo.findEffectiveById(recipeId, userId);
    if (!recipe) {
      throw new RecipeNotFoundError();
    }
    return this.toView(recipe.id, recipe.revisionId, recipe.ingredients.length);
  }

  async recalculate(recipeId: string, userId: string): Promise<NutritionView> {
    await this.requestForRecipe(recipeId, userId);
    return this.getForRecipe(recipeId, userId);
  }

  async correctMatch(
    recipeId: string,
    userId: string,
    input: CorrectFoodMatchInput,
  ): Promise<NutritionView> {
    const recipe = await this.recipeRepo.findEffectiveById(recipeId, userId);
    if (!recipe) {
      throw new RecipeNotFoundError();
    }
    const ingredient = recipe.ingredients.find((item) => item.id === input.ingredientId);
    if (!ingredient) {
      throw new RecipeNotFoundError({ message: 'Ingredient not found' });
    }
    const query = normalizeNutritionQuery(ingredient.canonicalName ?? ingredient.name);
    const fetched = await this.calculator.resolveByFdcId(input.fdcId);
    if (fetched) {
      await this.nutritionRepo.upsertQueryCache({
        query,
        fdcId: fetched.fdcId,
        matchedName: fetched.name,
        dataType: fetched.dataType,
      });
    }
    await this.requestForRevision({
      recipeId: recipe.id,
      revisionId: recipe.revisionId,
      userId,
    });
    return this.getForRecipe(recipeId, userId);
  }

  async requestForRecipe(recipeId: string, userId: string): Promise<void> {
    const recipe = await this.recipeRepo.findEffectiveById(recipeId, userId);
    if (!recipe) {
      throw new RecipeNotFoundError();
    }
    await this.requestForRevision({
      recipeId: recipe.id,
      revisionId: recipe.revisionId,
      userId,
    });
  }

  async requestForRevision(input: {
    recipeId: string;
    revisionId: string;
    userId: string;
  }): Promise<void> {
    const snapshots = await this.nutritionRepo.listSnapshotsForRevision(input.revisionId);
    const latest = snapshots[0];
    if (latest && (latest.status === 'PENDING' || latest.status === 'PROCESSING')) {
      return;
    }

    const meta = await this.nutritionRepo.findRevisionMeta(input.revisionId);
    const snapshot = await this.nutritionRepo.createSnapshot({
      recipeRevisionId: input.revisionId,
      status: 'PENDING',
      servings: meta?.servings ?? null,
    });

    try {
      await this.queue.enqueue(NUTRITION_JOB_NAME, { jobId: snapshot.id });
    } catch (error: unknown) {
      this.log.warn(
        { step: 'nutrition.enqueue', snapshotId: snapshot.id, recipeId: input.recipeId, err: error },
        'nutrition.enqueue failed',
      );
    }
  }

  async processSnapshot(snapshotId: string): Promise<void> {
    const snapshot = await this.nutritionRepo.findSnapshotById(snapshotId);
    if (!snapshot) {
      this.log.warn({ step: 'nutrition.process', snapshotId }, 'nutrition snapshot missing');
      return;
    }
    if (snapshot.status === 'COMPLETED' || snapshot.status === 'PARTIAL' || snapshot.status === 'FAILED') {
      return;
    }

    await this.nutritionRepo.updateSnapshotStatus(snapshotId, 'PROCESSING');
    const ingredients = await this.nutritionRepo.findRevisionIngredients(snapshot.recipeRevisionId);
    const meta = await this.nutritionRepo.findRevisionMeta(snapshot.recipeRevisionId);

    try {
      const result = await this.calculator.calculate(
        ingredients.map((ingredient) => ({
          id: ingredient.id,
          name: ingredient.name,
          canonicalName: ingredient.canonicalName,
          quantity: ingredient.quantity === null ? null : Number(ingredient.quantity),
          unit: ingredient.unit,
        })),
        meta?.servings ?? snapshot.servings,
      );

      await this.nutritionRepo.completeSnapshot(snapshotId, {
        status: result.status,
        servings: result.servings,
        wholeRecipe: result.wholeRecipe,
        perServing: result.perServing,
        per100g: result.per100g,
        coveragePercent: result.coveragePercent,
        unmatchedIngredients: result.unmatchedIngredients,
        provider: result.provider,
        calculatedAt: result.calculatedAt,
        totalGrams: result.totalGrams,
        failureReason: result.failureReason,
        matches: result.matches.map((match) => ({
          revisionIngredientId: match.ingredientId,
          query: match.query,
          matchedFoodId: match.matchedFoodId,
          matchedFoodName: match.matchedFoodName,
          confidence: match.confidence,
          grams: match.grams,
          nutrients: match.nutrients,
        })),
      });
    } catch (error: unknown) {
      if (error instanceof NutritionRateLimitError) {
        await this.nutritionRepo.updateSnapshotStatus(snapshotId, 'PENDING');
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Nutrition calculation failed';
      await this.nutritionRepo.updateSnapshotStatus(snapshotId, 'FAILED', message);
      this.log.error({ step: 'nutrition.process', snapshotId, err: error }, 'nutrition.process failed');
    }
  }

  private async toView(
    recipeId: string,
    revisionId: string,
    ingredientCount: number,
  ): Promise<NutritionView> {
    const snapshots = await this.nutritionRepo.listSnapshotsForRevision(revisionId);
    const latest = snapshots[0];
    const previousWithValues = snapshots.find(
      (item) =>
        (item.status === 'COMPLETED' || item.status === 'PARTIAL') &&
        (item.wholeRecipe !== null || item.perServing !== null),
    );
    const inFlight =
      latest !== undefined && (latest.status === 'PENDING' || latest.status === 'PROCESSING');
    const display = inFlight ? (previousWithValues ?? latest) : latest;
    const requested = latest !== undefined;
    const uxStatus = toNutritionUxStatus(latest?.status, requested);
    const matched = display
      ? display.matches.filter((match) => match.matchedFoodId !== null && match.grams !== null).length
      : 0;
    const total = display?.matches.length || ingredientCount;

    return {
      recipeId,
      revisionId,
      snapshotId: latest?.id ?? null,
      status: uxStatus,
      calculationStatus: latest?.status ?? null,
      updating: inFlight && previousWithValues !== undefined,
      provider: display?.provider ?? latest?.provider ?? null,
      calculatedAt: display?.calculatedAt?.toISOString() ?? null,
      servings: display?.servings ?? null,
      coverage: {
        matched,
        total,
        percent: display?.coveragePercent ?? (total === 0 ? 0 : Math.round((matched / total) * 100)),
      },
      unmatchedIngredients: display?.unmatchedIngredients ?? [],
      totals: display?.wholeRecipe ?? null,
      perPortion: display?.perServing ?? null,
      per100g: display?.per100g ?? null,
      matches: display?.matches ?? [],
      failureReason: latest?.failureReason ?? null,
    };
  }
}