import { Prisma, type RecipeReviewState, type RevisionSource } from '@prisma/client';

import { ValidationError } from '../../../shared/errors/app-error.js';
import {
  RecipeEngagementConflictError,
  RecipeNotFoundError,
  RecipeNoteNotFoundError,
  RecipeRevisionConflictError,
} from '../../../shared/errors/recipe-errors.js';
import { buildPaginationMeta } from '../../../shared/pagination/pagination.js';
import type { ListRecipesQuery, PatchRecipeBody } from '../api/recipes.schema.js';
import type {
  EffectiveRecipeRecord,
  IRecipeRepository,
  RecipeEngagementRecord,
  RecipeListRecord,
  RecipeNoteRecord,
  RecipeRevisionSummary,
} from '../repository/recipe.repository.js';
import { measurementsForEdit, stepExtrasForEdit } from './revision-measurements.js';

export interface RecipeDetailView {
  id: string;
  title: string;
  description: string | null;
  servings: number | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  totalTimeMinutes: number | null;
  difficulty: string | null;
  calories: number | null;
  nutritionSource: string | null;
  cuisine: string | null;
  nutrition: unknown;
  sourceLanguage: string | null;
  confidence: number;
  warnings: unknown;
  promptVersion: string | null;
  ingredients: EffectiveRecipeRecord['ingredients'];
  steps: EffectiveRecipeRecord['steps'];
  categories: EffectiveRecipeRecord['categories'];
  source: EffectiveRecipeRecord['source'];
  userRecipeId: string;
  revisionId: string;
  revisionNumber: number;
  revisionSource: RevisionSource;
  reviewState: RecipeReviewState;
  rating: number | null;
  ratingAverage: number | null;
  ratingCount: number;
  isFavorite: boolean;
  cookCount: number;
  createdAt: Date;
  updatedAt: Date;
}

function toQuantityDecimal(
  quantity: string | number | Prisma.Decimal | null,
): Prisma.Decimal | null {
  return quantity === null
    ? null
    : quantity instanceof Prisma.Decimal
      ? quantity
      : new Prisma.Decimal(quantity);
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function resolveTotalTimeMinutes(
  existing: Pick<EffectiveRecipeRecord, 'prepTimeMinutes' | 'cookTimeMinutes'>,
  patch: PatchRecipeBody,
): number | null | undefined {
  if (patch.totalTimeMinutes !== undefined) {
    return patch.totalTimeMinutes;
  }

  if (patch.prepTimeMinutes === undefined && patch.cookTimeMinutes === undefined) {
    return undefined;
  }

  const newPrep =
    patch.prepTimeMinutes !== undefined ? patch.prepTimeMinutes : existing.prepTimeMinutes;
  const newCook =
    patch.cookTimeMinutes !== undefined ? patch.cookTimeMinutes : existing.cookTimeMinutes;
  const prep = newPrep ?? 0;
  const cook = newCook ?? 0;

  return prep === 0 && cook === 0 ? null : prep + cook;
}

export class RecipeService {
  constructor(private readonly recipeRepo: IRecipeRepository) {}

  async getById(id: string): Promise<RecipeDetailView> {
    return this.getByIdForProfile(id, '00000000-0000-4000-8000-000000000001');
  }

  async getByIdForProfile(id: string, userId: string): Promise<RecipeDetailView> {
    const recipe = await this.recipeRepo.findEffectiveById(id, userId);
    if (!recipe) {
      throw new RecipeNotFoundError();
    }
    return this.toDetailView(recipe);
  }

  async list(
    query: ListRecipesQuery,
    userId = '00000000-0000-4000-8000-000000000001',
  ): Promise<{ items: RecipeListRecord[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { items, total } = await this.recipeRepo.list({
      page: query.page,
      pageSize: query.pageSize,
      ...(query.q !== undefined ? { q: query.q } : {}),
      ...(query.cuisine !== undefined ? { cuisine: query.cuisine } : {}),
      ...(query.sourceType !== undefined ? { sourceType: query.sourceType } : {}),
      sort: query.sort,
      userId,
    });

    return {
      items,
      meta: buildPaginationMeta(query, total),
    };
  }

  async update(id: string, patch: PatchRecipeBody): Promise<RecipeDetailView> {
    return this.updateForProfile(id, '00000000-0000-4000-8000-000000000001', patch);
  }

  async updateForProfile(
    id: string,
    userId: string,
    patch: PatchRecipeBody,
  ): Promise<RecipeDetailView> {
    const existing = await this.recipeRepo.findEffectiveById(id, userId);
    if (!existing) {
      throw new RecipeNotFoundError();
    }
    const ingredients = (patch.ingredients ?? existing.ingredients).map((ingredient) => {
      const quantity = toQuantityDecimal(ingredient.quantity ?? null);
      const unit = ingredient.unit ?? null;
      return {
        name: ingredient.name,
        canonicalName: ingredient.canonicalName ?? null,
        quantity,
        unit,
        ...measurementsForEdit({ name: ingredient.name, quantity, unit }, existing.ingredients),
        preparation: ingredient.preparation ?? null,
        optional: ingredient.optional,
        emoji: ingredient.emoji ?? '🥣',
        colorToken: ingredient.colorToken ?? 'peach',
        category: ingredient.category ?? 'Pantry',
        sortOrder: ingredient.sortOrder,
      };
    });
    const orderedIngredients = [...ingredients].sort((a, b) => a.sortOrder - b.sortOrder);
    const steps = (patch.steps ?? existing.steps).map((step) => {
      const temperature = step.temperature ?? null;
      const previous =
        existing.steps.find((item) => item.instruction.trim() === step.instruction.trim()) ??
        existing.steps.find((item) => item.stepOrder === step.stepOrder);
      const title = blankToNull(step.title !== undefined ? step.title : (previous?.title ?? null));
      return {
        stepOrder: step.stepOrder,
        title,
        instruction: step.instruction,
        ahead: step.ahead !== undefined ? step.ahead : (previous?.ahead ?? false),
        durationMinutes: step.durationMinutes ?? null,
        temperature,
        ...stepExtrasForEdit(
          { instruction: step.instruction, temperature },
          existing.steps,
          existing.ingredients,
          orderedIngredients,
        ),
        stage: step.stage ?? 'COOK',
      };
    });
    const totalTimeMinutes = resolveTotalTimeMinutes(existing, patch);
    const result = await this.recipeRepo.appendRevision(
      id,
      userId,
      patch.expectedRevisionNumber ?? existing.revisionNumber,
      {
        title: patch.title ?? existing.title,
        description: patch.description !== undefined ? patch.description : existing.description,
        servings: patch.servings !== undefined ? patch.servings : existing.servings,
        prepTimeMinutes:
          patch.prepTimeMinutes !== undefined ? patch.prepTimeMinutes : existing.prepTimeMinutes,
        cookTimeMinutes:
          patch.cookTimeMinutes !== undefined ? patch.cookTimeMinutes : existing.cookTimeMinutes,
        totalTimeMinutes:
          totalTimeMinutes !== undefined ? totalTimeMinutes : existing.totalTimeMinutes,
        ...(patch.difficulty !== undefined ? { difficulty: patch.difficulty } : {}),
        calories: patch.calories !== undefined ? patch.calories : existing.calories,
        cuisine: patch.cuisine !== undefined ? patch.cuisine : existing.cuisine,
        categoryIds: patch.categoryIds ?? existing.categories.map((category) => category.id),
        ingredients,
        steps,
      },
    );
    if (result === 'conflict') throw new RecipeRevisionConflictError();
    if (result === 'invalid-categories') {
      throw new ValidationError({
        message: 'One or more categories do not belong to this profile',
        details: [{ path: 'body.categoryIds', message: 'Invalid category ownership' }],
      });
    }
    if (!result) throw new RecipeNotFoundError();
    return this.toDetailView(result);
  }

  async listRevisions(id: string, userId: string): Promise<RecipeRevisionSummary[]> {
    const revisions = await this.recipeRepo.listRevisions(id, userId);
    if (!revisions) throw new RecipeNotFoundError();
    return revisions;
  }

  async getRevision(
    id: string,
    revisionId: string,
    userId: string,
  ): Promise<RecipeDetailView & { summary: string; changes: string[] }> {
    const revision = await this.recipeRepo.findRevision(id, revisionId, userId);
    if (!revision) throw new RecipeNotFoundError({ message: 'Recipe revision not found' });
    const all = await this.recipeRepo.listRevisions(id, userId);
    const summary = all?.find((item) => item.id === revisionId);
    return {
      ...this.toDetailView(revision),
      summary: summary?.summary ?? '',
      changes: summary?.changes ?? [],
    };
  }

  async restoreRevision(
    id: string,
    revisionId: string,
    userId: string,
    expectedRevisionNumber: number,
  ): Promise<RecipeDetailView> {
    const result = await this.recipeRepo.restoreRevision(
      id,
      revisionId,
      userId,
      expectedRevisionNumber,
    );
    if (result === 'conflict') throw new RecipeRevisionConflictError();
    if (!result) throw new RecipeNotFoundError({ message: 'Recipe revision not found' });
    return this.toDetailView(result);
  }

  async delete(id: string): Promise<void> {
    return this.deleteForProfile(id, '00000000-0000-4000-8000-000000000001');
  }

  async deleteForProfile(id: string, userId: string): Promise<void> {
    const recipe = await this.recipeRepo.findEffectiveById(id, userId);
    if (!recipe) {
      throw new RecipeNotFoundError();
    }

    await this.recipeRepo.delete(id);
  }

  async setFavorite(
    id: string,
    userId: string,
    isFavorite: boolean,
    expectedUpdatedAt?: Date,
  ): Promise<RecipeEngagementRecord> {
    const result = await this.recipeRepo.setFavorite(id, userId, isFavorite, expectedUpdatedAt);
    if (result === 'conflict') throw new RecipeEngagementConflictError();
    if (!result) throw new RecipeNotFoundError();
    return result;
  }

  async setRating(
    id: string,
    userId: string,
    rating: number | null,
    expectedUpdatedAt?: Date,
  ): Promise<RecipeEngagementRecord> {
    const result = await this.recipeRepo.setRating(id, userId, rating, expectedUpdatedAt);
    if (result === 'conflict') throw new RecipeEngagementConflictError();
    if (!result) throw new RecipeNotFoundError();
    return result;
  }

  async setReviewState(
    id: string,
    userId: string,
    reviewState: RecipeReviewState,
    expectedUpdatedAt?: Date,
  ): Promise<RecipeEngagementRecord> {
    const result = await this.recipeRepo.setReviewState(
      id,
      userId,
      reviewState,
      expectedUpdatedAt,
    );
    if (result === 'conflict') throw new RecipeEngagementConflictError();
    if (!result) throw new RecipeNotFoundError();
    return result;
  }

  async listNotes(id: string, userId: string): Promise<RecipeNoteRecord[]> {
    const notes = await this.recipeRepo.listNotes(id, userId);
    if (!notes) throw new RecipeNotFoundError();
    return notes;
  }

  async createNote(
    id: string,
    userId: string,
    input: { body: string; cookSessionId?: string | null },
  ): Promise<RecipeNoteRecord> {
    const result = await this.recipeRepo.createNote(id, userId, input);
    if (result === 'invalid-session') {
      throw new ValidationError({
        message: 'Cook session does not belong to this recipe',
        details: [{ path: 'body.cookSessionId', message: 'Invalid cook session' }],
      });
    }
    if (!result) throw new RecipeNotFoundError();
    return result;
  }

  async updateNote(
    id: string,
    noteId: string,
    userId: string,
    input: { body?: string; cookSessionId?: string | null },
  ): Promise<RecipeNoteRecord> {
    const result = await this.recipeRepo.updateNote(id, noteId, userId, input);
    if (result === 'invalid-session') {
      throw new ValidationError({
        message: 'Cook session does not belong to this recipe',
        details: [{ path: 'body.cookSessionId', message: 'Invalid cook session' }],
      });
    }
    if (!result) throw new RecipeNoteNotFoundError();
    return result;
  }

  async deleteNote(id: string, noteId: string, userId: string): Promise<void> {
    const owned = await this.recipeRepo.listNotes(id, userId);
    if (!owned) throw new RecipeNotFoundError();
    const deleted = await this.recipeRepo.deleteNote(id, noteId, userId);
    if (!deleted) throw new RecipeNoteNotFoundError();
  }

  private toDetailView(recipe: EffectiveRecipeRecord): RecipeDetailView {
    return {
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      servings: recipe.servings,
      prepTimeMinutes: recipe.prepTimeMinutes,
      cookTimeMinutes: recipe.cookTimeMinutes,
      totalTimeMinutes: recipe.totalTimeMinutes,
      difficulty: recipe.difficulty,
      calories: recipe.calories,
      nutritionSource: recipe.nutritionSource,
      cuisine: recipe.cuisine,
      nutrition: recipe.nutrition,
      sourceLanguage: recipe.sourceLanguage,
      confidence: recipe.confidence,
      warnings: recipe.warnings,
      promptVersion: recipe.promptVersion,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      categories: recipe.categories,
      source: recipe.source,
      userRecipeId: recipe.userRecipeId,
      revisionId: recipe.revisionId,
      revisionNumber: recipe.revisionNumber,
      revisionSource: recipe.revisionSource,
      reviewState: recipe.reviewState,
      rating: recipe.rating,
      ratingAverage: recipe.rating,
      ratingCount: recipe.rating == null ? 0 : 1,
      isFavorite: recipe.isFavorite,
      cookCount: recipe.cookCount,
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt,
    };
  }
}
