import { Prisma, type RecipeIngredient, type RecipeSource, type RecipeStep } from '@prisma/client';

import { RecipeNotFoundError } from '../../../shared/errors/recipe-errors.js';
import { buildPaginationMeta } from '../../../shared/pagination/pagination.js';
import type { ListRecipesQuery, PatchRecipeBody } from '../api/recipes.schema.js';
import type {
  CreateRecipeIngredientInput,
  CreateRecipeInput,
  CreateRecipeStepInput,
  IRecipeRepository,
  RecipeListRecord,
  RecipeWithDetails,
} from '../repository/recipe.repository.js';

export interface RecipeDetailView {
  id: string;
  title: string;
  description: string | null;
  servings: number | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  totalTimeMinutes: number | null;
  calories: number | null;
  cuisine: string | null;
  nutrition: unknown;
  sourceLanguage: string | null;
  confidence: number;
  warnings: unknown;
  promptVersion: string | null;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  source: RecipeSource | null;
  createdAt: Date;
  updatedAt: Date;
}

function toQuantityDecimal(quantity: string | number | null): Prisma.Decimal | null {
  return quantity === null ? null : new Prisma.Decimal(quantity);
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function resolveTotalTimeMinutes(
  existing: RecipeWithDetails,
  patch: PatchRecipeBody,
): number | null | undefined {
  if (patch.totalTimeMinutes !== undefined) {
    return patch.totalTimeMinutes;
  }

  if (patch.prepTimeMinutes === undefined && patch.cookTimeMinutes === undefined) {
    return undefined;
  }

  const newPrep = patch.prepTimeMinutes !== undefined ? patch.prepTimeMinutes : existing.prepTimeMinutes;
  const newCook = patch.cookTimeMinutes !== undefined ? patch.cookTimeMinutes : existing.cookTimeMinutes;
  const prep = newPrep ?? 0;
  const cook = newCook ?? 0;

  return prep === 0 && cook === 0 ? null : prep + cook;
}

function mapPatchIngredients(
  ingredients: NonNullable<PatchRecipeBody['ingredients']>,
): CreateRecipeIngredientInput[] {
  return ingredients.map((ing) => {
    const mapped: CreateRecipeIngredientInput = {
      name: ing.name,
      unit: ing.unit,
      preparation: ing.preparation,
      optional: ing.optional,
      sortOrder: ing.sortOrder,
    };

    if (ing.canonicalName !== undefined) {
      mapped.canonicalName = ing.canonicalName;
    }
    if (ing.quantity !== undefined) {
      mapped.quantity = toQuantityDecimal(ing.quantity);
    }
    if (ing.category !== undefined) {
      mapped.category = ing.category;
    }
    if (ing.confidence !== undefined) {
      mapped.confidence = ing.confidence;
    }
    if (ing.provenance !== undefined) {
      mapped.provenance = toInputJson(ing.provenance);
    }
    if (ing.warnings !== undefined) {
      mapped.warnings = toInputJson(ing.warnings);
    }

    return mapped;
  });
}

function mapPatchSteps(steps: NonNullable<PatchRecipeBody['steps']>): CreateRecipeStepInput[] {
  return steps.map((step) => {
    const mapped: CreateRecipeStepInput = {
      stepOrder: step.stepOrder,
      instruction: step.instruction,
      durationMinutes: step.durationMinutes,
      temperature: step.temperature,
    };

    if (step.stage !== undefined) {
      mapped.stage = step.stage;
    }
    if (step.confidence !== undefined) {
      mapped.confidence = step.confidence;
    }
    if (step.provenance !== undefined) {
      mapped.provenance = toInputJson(step.provenance);
    }
    if (step.warnings !== undefined) {
      mapped.warnings = toInputJson(step.warnings);
    }

    return mapped;
  });
}

function toUpdateInput(
  existing: RecipeWithDetails,
  patch: PatchRecipeBody,
): Partial<Omit<CreateRecipeInput, 'recipeSourceId'>> {
  const input: Partial<Omit<CreateRecipeInput, 'recipeSourceId'>> = {};

  if (patch.title !== undefined) {
    input.title = patch.title;
  }
  if (patch.description !== undefined) {
    input.description = patch.description;
  }
  if (patch.servings !== undefined) {
    input.servings = patch.servings;
  }
  if (patch.prepTimeMinutes !== undefined) {
    input.prepTimeMinutes = patch.prepTimeMinutes;
  }
  if (patch.cookTimeMinutes !== undefined) {
    input.cookTimeMinutes = patch.cookTimeMinutes;
  }
  if (patch.calories !== undefined) {
    input.calories = patch.calories;
  }
  if (patch.cuisine !== undefined) {
    input.cuisine = patch.cuisine;
  }

  const totalTimeMinutes = resolveTotalTimeMinutes(existing, patch);
  if (totalTimeMinutes !== undefined) {
    input.totalTimeMinutes = totalTimeMinutes;
  }

  if (patch.ingredients !== undefined) {
    input.ingredients = mapPatchIngredients(patch.ingredients);
  }
  if (patch.steps !== undefined) {
    input.steps = mapPatchSteps(patch.steps);
  }

  return input;
}

export class RecipeService {
  constructor(
    private readonly recipeRepo: IRecipeRepository,
    private readonly sourceRepo: { findById(id: string): Promise<RecipeSource | null> },
  ) {}

  async getById(id: string): Promise<RecipeDetailView> {
    const recipe = await this.recipeRepo.findById(id);
    if (!recipe) {
      throw new RecipeNotFoundError();
    }

    const source = await this.sourceRepo.findById(recipe.recipeSourceId);

    return this.toDetailView(recipe, source);
  }

  async list(
    query: ListRecipesQuery,
  ): Promise<{ items: RecipeListRecord[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { items, total } = await this.recipeRepo.list({
      page: query.page,
      pageSize: query.pageSize,
      ...(query.q !== undefined ? { q: query.q } : {}),
      ...(query.cuisine !== undefined ? { cuisine: query.cuisine } : {}),
      ...(query.sourceType !== undefined ? { sourceType: query.sourceType } : {}),
    });

    return {
      items,
      meta: buildPaginationMeta(query, total),
    };
  }

  async update(id: string, patch: PatchRecipeBody): Promise<RecipeDetailView> {
    const existing = await this.recipeRepo.findById(id);
    if (!existing) {
      throw new RecipeNotFoundError();
    }

    const updated = await this.recipeRepo.update(id, toUpdateInput(existing, patch));
    const source = await this.sourceRepo.findById(updated.recipeSourceId);

    return this.toDetailView(updated, source);
  }

  async delete(id: string): Promise<void> {
    const recipe = await this.recipeRepo.findById(id);
    if (!recipe) {
      throw new RecipeNotFoundError();
    }

    await this.recipeRepo.delete(id);
  }

  private toDetailView(recipe: RecipeWithDetails, source: RecipeSource | null): RecipeDetailView {
    return {
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      servings: recipe.servings,
      prepTimeMinutes: recipe.prepTimeMinutes,
      cookTimeMinutes: recipe.cookTimeMinutes,
      totalTimeMinutes: recipe.totalTimeMinutes,
      calories: recipe.calories,
      cuisine: recipe.cuisine,
      nutrition: recipe.nutrition,
      sourceLanguage: recipe.sourceLanguage,
      confidence: recipe.confidence,
      warnings: recipe.warnings,
      promptVersion: recipe.promptVersion,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      source,
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt,
    };
  }
}
