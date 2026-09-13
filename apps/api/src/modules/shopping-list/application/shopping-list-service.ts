import { Prisma } from '@prisma/client';
import { pantryHasIngredient, ShoppingListSource } from '@recipe/contracts';

import { RecipeNotFoundError } from '../../../shared/errors/recipe-errors.js';
import { ShoppingListItemNotFoundError } from '../../../shared/errors/shopping-list-errors.js';
import { buildPaginationMeta } from '../../../shared/pagination/pagination.js';
import { toSentenceCase } from '../../normalization/domain/casing.js';
import { resolveIngredientPresentation } from '../../normalization/domain/presentation.js';
import { normalizeIngredientName, normalizeUnit } from '../../normalization/domain/units.js';
import type { IPantryRepository } from '../../pantry/repository/pantry.repository.js';
import type { IRecipeRepository } from '../../recipes/repository/recipe.repository.js';
import type {
  CreateShoppingListItemsBody,
  FromRecipeBody,
  ListShoppingListQuery,
  PatchShoppingListItemBody,
} from '../api/shopping-list.schema.js';
import type {
  CreateShoppingListItemInput,
  IShoppingListRepository,
  ShoppingListItemRecord,
} from '../repository/shopping-list.repository.js';

export interface ShoppingListItemView {
  id: string;
  name: string;
  canonicalName: string | null;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  emoji: string | null;
  done: boolean;
  fromRecipeCount: number;
  source: (typeof ShoppingListSource)[keyof typeof ShoppingListSource];
  sourceRecipeId: string | null;
  sourceMealPlanEntryId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UpsertShoppingListItemInput {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  category?: string | null;
  emoji?: string | null;
  source: (typeof ShoppingListSource)[keyof typeof ShoppingListSource];
  sourceRecipeId?: string | null;
  sourceMealPlanEntryId?: string | null;
  incrementFromRecipe: boolean;
}

export interface AddFromRecipeOptions {
  source?: (typeof ShoppingListSource)[keyof typeof ShoppingListSource];
  sourceMealPlanEntryId?: string;
}

function toQuantity(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

function toSource(
  value: string,
): (typeof ShoppingListSource)[keyof typeof ShoppingListSource] {
  if (value === ShoppingListSource.RECIPE || value === ShoppingListSource.MEAL_PLAN) {
    return value;
  }
  return ShoppingListSource.MANUAL;
}

function toView(record: ShoppingListItemRecord): ShoppingListItemView {
  return {
    id: record.id,
    name: record.name,
    canonicalName: record.canonicalName,
    quantity: toQuantity(record.quantity),
    unit: record.unit,
    category: record.category,
    emoji: record.emoji,
    done: record.done,
    fromRecipeCount: record.fromRecipeCount,
    source: toSource(record.source),
    sourceRecipeId: record.sourceRecipeId,
    sourceMealPlanEntryId: record.sourceMealPlanEntryId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function unitsMatch(left: string | null, right: string | null): boolean {
  return normalizeUnit(left) === normalizeUnit(right);
}

function mergedQuantity(
  existing: Prisma.Decimal | null,
  incoming: Prisma.Decimal | null,
): Prisma.Decimal | null {
  if (existing === null && incoming === null) {
    return null;
  }
  return new Prisma.Decimal(Number(existing ?? 0) + Number(incoming ?? 0));
}

export class ShoppingListService {
  constructor(
    private readonly repo: IShoppingListRepository,
    private readonly pantryRepo: IPantryRepository,
    private readonly recipeRepo: IRecipeRepository,
  ) {}

  async list(
    userId: string,
    query: ListShoppingListQuery,
  ): Promise<{ items: ShoppingListItemView[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { items, total } = await this.repo.list({
      userId,
      page: query.page,
      pageSize: query.pageSize,
      ...(query.done !== undefined ? { done: query.done } : {}),
    });
    return {
      items: items.map(toView),
      meta: buildPaginationMeta(query, total),
    };
  }

  async createMany(userId: string, body: CreateShoppingListItemsBody): Promise<ShoppingListItemView[]> {
    const created: ShoppingListItemView[] = [];
    for (const item of body.items) {
      created.push(
        await this.upsertOne(userId, {
          name: item.name,
          ...(item.quantity !== undefined ? { quantity: item.quantity } : {}),
          ...(item.unit !== undefined ? { unit: item.unit } : {}),
          ...(item.category !== undefined ? { category: item.category } : {}),
          ...(item.emoji !== undefined ? { emoji: item.emoji } : {}),
          source: item.sourceRecipeId ? ShoppingListSource.RECIPE : ShoppingListSource.MANUAL,
          ...(item.sourceRecipeId !== undefined ? { sourceRecipeId: item.sourceRecipeId } : {}),
          incrementFromRecipe: item.sourceRecipeId !== undefined,
        }),
      );
    }
    return created;
  }

  async addFromRecipe(
    userId: string,
    body: FromRecipeBody,
    options: AddFromRecipeOptions = {},
  ): Promise<ShoppingListItemView[]> {
    const recipe = await this.recipeRepo.findEffectiveById(body.recipeId, userId);
    if (!recipe) {
      throw new RecipeNotFoundError();
    }

    const pantryKeys = await this.loadPantryKeys(userId);
    const scale =
      body.servings !== undefined && recipe.servings !== null && recipe.servings > 0
        ? body.servings / recipe.servings
        : 1;
    const source = options.source ?? ShoppingListSource.RECIPE;

    const created: ShoppingListItemView[] = [];
    for (const ingredient of recipe.ingredients) {
      if (
        pantryHasIngredient(
          { name: ingredient.name, canonicalName: ingredient.canonicalName },
          pantryKeys,
        )
      ) {
        continue;
      }
      const quantity =
        ingredient.quantity === null ? null : Number(ingredient.quantity) * scale;
      created.push(
        await this.upsertOne(userId, {
          name: ingredient.name,
          quantity,
          ...(ingredient.unit !== null ? { unit: ingredient.unit } : {}),
          ...(ingredient.category ? { category: ingredient.category } : {}),
          ...(ingredient.emoji ? { emoji: ingredient.emoji } : {}),
          source,
          sourceRecipeId: body.recipeId,
          ...(options.sourceMealPlanEntryId !== undefined
            ? { sourceMealPlanEntryId: options.sourceMealPlanEntryId }
            : {}),
          incrementFromRecipe: true,
        }),
      );
    }
    return created;
  }

  async update(
    userId: string,
    id: string,
    body: PatchShoppingListItemBody,
  ): Promise<ShoppingListItemView> {
    const existing = await this.repo.findById(id, userId);
    if (!existing) {
      throw new ShoppingListItemNotFoundError();
    }

    const name = body.name ?? existing.name;
    const canonicalName =
      body.name !== undefined ? normalizeIngredientName(body.name) : existing.canonicalName;
    const updated = await this.repo.update(id, userId, {
      ...(body.name !== undefined
        ? { name: toSentenceCase(name), canonicalName: canonicalName ?? normalizeIngredientName(name) }
        : {}),
      ...(body.quantity !== undefined
        ? { quantity: body.quantity === null ? null : new Prisma.Decimal(body.quantity) }
        : {}),
      ...(body.unit !== undefined ? { unit: body.unit } : {}),
      ...(body.done !== undefined ? { done: body.done } : {}),
    });
    if (!updated) {
      throw new ShoppingListItemNotFoundError();
    }
    return toView(updated);
  }

  async delete(userId: string, id: string): Promise<void> {
    const deleted = await this.repo.delete(id, userId);
    if (!deleted) {
      throw new ShoppingListItemNotFoundError();
    }
  }

  async clearDone(userId: string): Promise<number> {
    return this.repo.deleteDone(userId);
  }

  async deleteByMealPlanEntry(userId: string, sourceMealPlanEntryId: string): Promise<number> {
    return this.repo.deleteBySourceMealPlanEntryId(userId, sourceMealPlanEntryId);
  }

  private async loadPantryKeys(userId: string): Promise<string[]> {
    const keys: string[] = [];
    let page = 1;
    const pageSize = 100;
    for (;;) {
      const { items, total } = await this.pantryRepo.list({ userId, page, pageSize });
      for (const item of items) {
        keys.push(item.canonicalName ?? item.name);
      }
      if (items.length === 0 || keys.length >= total) {
        break;
      }
      page += 1;
    }
    return keys;
  }

  private async upsertOne(
    userId: string,
    item: UpsertShoppingListItemInput,
  ): Promise<ShoppingListItemView> {
    const presentation = resolveIngredientPresentation({
      name: item.name,
      category: item.category,
      emoji: item.emoji,
    });
    const canonicalName = normalizeIngredientName(item.name);
    const quantity =
      item.quantity === undefined || item.quantity === null
        ? null
        : new Prisma.Decimal(item.quantity);
    const unit = item.unit ?? null;
    const fromRecipeCount = item.incrementFromRecipe ? 1 : 0;
    const payload: CreateShoppingListItemInput = {
      userId,
      name: toSentenceCase(item.name),
      canonicalName,
      quantity,
      unit,
      category: presentation.category,
      emoji: presentation.emoji,
      fromRecipeCount,
      source: item.source,
      ...(item.sourceRecipeId !== undefined ? { sourceRecipeId: item.sourceRecipeId } : {}),
      ...(item.sourceMealPlanEntryId !== undefined
        ? { sourceMealPlanEntryId: item.sourceMealPlanEntryId }
        : {}),
    };

    const existing = await this.repo.findByCanonicalName(userId, canonicalName);
    if (existing) {
      const incomingUnit = item.unit === undefined ? existing.unit : item.unit;
      const nextQuantity = unitsMatch(existing.unit, incomingUnit)
        ? mergedQuantity(existing.quantity, quantity)
        : existing.quantity;
      const updated = await this.repo.update(existing.id, userId, {
        name: payload.name,
        quantity: nextQuantity,
        fromRecipeCount: existing.fromRecipeCount + 1,
        ...(existing.source === ShoppingListSource.MANUAL && item.source !== ShoppingListSource.MANUAL
          ? { source: item.source }
          : {}),
        ...(existing.sourceRecipeId === null && item.sourceRecipeId
          ? { sourceRecipeId: item.sourceRecipeId }
          : {}),
        ...(existing.sourceMealPlanEntryId === null && item.sourceMealPlanEntryId
          ? { sourceMealPlanEntryId: item.sourceMealPlanEntryId }
          : {}),
      });
      if (!updated) {
        throw new ShoppingListItemNotFoundError();
      }
      return toView(updated);
    }

    return toView(await this.repo.create(payload));
  }
}
