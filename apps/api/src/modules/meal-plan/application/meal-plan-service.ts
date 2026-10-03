import { MealEntryKind, ShoppingListSource } from '@recipe/contracts';
import type { MealSlot } from '@prisma/client';

import { ValidationError } from '../../../shared/errors/app-error.js';
import { MealPlanEntryNotFoundError } from '../../../shared/errors/meal-plan-errors.js';
import { RecipeNotFoundError } from '../../../shared/errors/recipe-errors.js';
import type { IRecipeRepository } from '../../recipes/repository/recipe.repository.js';
import type { ShoppingListService } from '../../shopping-list/application/shopping-list-service.js';
import type {
  CreateMealPlanEntryBody,
  ListMealPlanQuery,
  PatchMealPlanEntryBody,
  ReorderMealPlanBody,
} from '../api/meal-plan.schema.js';
import type {
  IMealPlanRepository,
  MealPlanEntryRecord,
  MealPlanReorderUpdate,
} from '../repository/meal-plan.repository.js';

export interface MealPlanEntryView {
  id: string;
  date: string;
  slot: MealSlot;
  kind: (typeof MealEntryKind)[keyof typeof MealEntryKind];
  recipeId: string | null;
  note: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

function parseDateOnly(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toKind(
  value: string,
): (typeof MealEntryKind)[keyof typeof MealEntryKind] {
  return value === MealEntryKind.NOTE ? MealEntryKind.NOTE : MealEntryKind.RECIPE;
}

function toView(record: MealPlanEntryRecord): MealPlanEntryView {
  return {
    id: record.id,
    date: formatDateOnly(record.date),
    slot: record.slot,
    kind: toKind(record.kind),
    recipeId: record.recipeId,
    note: record.note,
    sortOrder: record.sortOrder,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

const SLOT_ORDER: Record<MealSlot, number> = {
  BREAKFAST: 0,
  LUNCH: 1,
  DINNER: 2,
  SNACK: 3,
};

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    ordered.push(id);
  }
  return ordered;
}

export class MealPlanService {
  constructor(
    private readonly repo: IMealPlanRepository,
    private readonly recipeRepo: IRecipeRepository,
    private readonly shoppingListService: ShoppingListService,
  ) {}

  async list(userId: string, query: ListMealPlanQuery): Promise<MealPlanEntryView[]> {
    const items = await this.repo.listByDateRange({
      userId,
      from: parseDateOnly(query.from),
      to: parseDateOnly(query.to),
    });
    return items.map(toView);
  }

  async create(userId: string, body: CreateMealPlanEntryBody): Promise<MealPlanEntryView> {
    const recipeId = body.kind === MealEntryKind.RECIPE ? body.recipeId : undefined;
    if (body.kind === MealEntryKind.RECIPE) {
      if (!recipeId) {
        throw new ValidationError({ message: 'recipeId is required when kind is RECIPE' });
      }
      const recipe = await this.recipeRepo.findEffectiveById(recipeId, userId);
      if (!recipe) {
        throw new RecipeNotFoundError();
      }
    }

    const date = parseDateOnly(body.date);
    const sortOrder = (await this.repo.maxSortOrder(userId, date, body.slot)) + 1;
    const entry = await this.repo.create({
      userId,
      date,
      slot: body.slot,
      kind: body.kind,
      recipeId: recipeId ?? null,
      note: body.note ?? null,
      sortOrder,
    });

    if (body.kind === MealEntryKind.RECIPE && recipeId) {
      await this.shoppingListService.addFromRecipe(
        userId,
        { recipeId },
        {
          source: ShoppingListSource.MEAL_PLAN,
          sourceMealPlanEntryId: entry.id,
        },
      );
    }

    return toView(entry);
  }

  async update(
    userId: string,
    id: string,
    body: PatchMealPlanEntryBody,
  ): Promise<MealPlanEntryView> {
    const existing = await this.repo.findById(id, userId);
    if (!existing) {
      throw new MealPlanEntryNotFoundError();
    }
    if (existing.kind === MealEntryKind.NOTE && body.note === null) {
      throw new ValidationError({
        message: 'note is required when kind is NOTE',
        details: [{ path: 'body.note', message: 'note is required when kind is NOTE' }],
      });
    }

    const updated = await this.repo.update(id, userId, {
      ...(body.date !== undefined ? { date: parseDateOnly(body.date) } : {}),
      ...(body.slot !== undefined ? { slot: body.slot } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      ...(body.note !== undefined ? { note: body.note } : {}),
    });
    if (!updated) {
      throw new MealPlanEntryNotFoundError();
    }
    return toView(updated);
  }

  async delete(userId: string, id: string): Promise<void> {
    const existing = await this.repo.findById(id, userId);
    if (!existing) {
      throw new MealPlanEntryNotFoundError();
    }
    if (existing.kind === MealEntryKind.RECIPE) {
      await this.shoppingListService.deleteByMealPlanEntry(userId, existing.id);
    }
    const deleted = await this.repo.delete(id, userId);
    if (!deleted) {
      throw new MealPlanEntryNotFoundError();
    }
  }

  async reorder(userId: string, body: ReorderMealPlanBody): Promise<MealPlanEntryView[]> {
    const updates = await this.resolveReorderUpdates(userId, body);
    const items = await this.repo.reorder(userId, updates);
    return items
      .map(toView)
      .sort((left, right) => {
        if (left.date !== right.date) {
          return left.date.localeCompare(right.date);
        }
        if (left.slot !== right.slot) {
          return SLOT_ORDER[left.slot] - SLOT_ORDER[right.slot];
        }
        return left.sortOrder - right.sortOrder;
      });
  }

  private async resolveReorderUpdates(
    userId: string,
    body: ReorderMealPlanBody,
  ): Promise<MealPlanReorderUpdate[]> {
    if ('ids' in body) {
      const ids = uniqueIds(body.ids);
      if (ids.length !== body.ids.length) {
        throw new ValidationError({ message: 'ids must not contain duplicates' });
      }
      const existing = await this.repo.findManyByIds(ids, userId);
      if (existing.length !== ids.length) {
        throw new MealPlanEntryNotFoundError();
      }
      return ids.map((id, index) => ({ id, sortOrder: index }));
    }

    const ids = uniqueIds(body.entries.map((entry) => entry.id));
    if (ids.length !== body.entries.length) {
      throw new ValidationError({ message: 'entries must not contain duplicate ids' });
    }
    const existing = await this.repo.findManyByIds(ids, userId);
    if (existing.length !== ids.length) {
      throw new MealPlanEntryNotFoundError();
    }
    return body.entries.map((entry) => ({
      id: entry.id,
      date: parseDateOnly(entry.date),
      slot: entry.slot,
      sortOrder: entry.sortOrder,
    }));
  }
}
