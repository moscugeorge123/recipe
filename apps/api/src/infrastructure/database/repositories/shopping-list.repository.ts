import type { Prisma, PrismaClient } from '@prisma/client';

import type {
  CreateShoppingListItemInput,
  IShoppingListRepository,
  ShoppingListItemRecord,
  UpdateShoppingListItemInput,
} from '../../../modules/shopping-list/repository/shopping-list.repository.js';

export class PrismaShoppingListRepository implements IShoppingListRepository {
  constructor(private readonly db: PrismaClient) {}

  async list(params: {
    userId: string;
    page: number;
    pageSize: number;
    done?: boolean;
  }): Promise<{ items: ShoppingListItemRecord[]; total: number }> {
    const where = {
      userId: params.userId,
      ...(params.done !== undefined ? { done: params.done } : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.shoppingListItem.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.db.shoppingListItem.count({ where }),
    ]);
    return { items, total };
  }

  findById(id: string, userId: string): Promise<ShoppingListItemRecord | null> {
    return this.db.shoppingListItem.findFirst({ where: { id, userId } });
  }

  findByCanonicalName(userId: string, canonicalName: string): Promise<ShoppingListItemRecord | null> {
    return this.db.shoppingListItem.findFirst({
      where: { userId, canonicalName },
      orderBy: { updatedAt: 'desc' },
    });
  }

  create(input: CreateShoppingListItemInput): Promise<ShoppingListItemRecord> {
    return this.db.shoppingListItem.create({
      data: {
        userId: input.userId,
        name: input.name,
        canonicalName: input.canonicalName ?? null,
        quantity: input.quantity ?? null,
        unit: input.unit ?? null,
        category: input.category ?? null,
        emoji: input.emoji ?? null,
        ...(input.done !== undefined ? { done: input.done } : {}),
        ...(input.fromRecipeCount !== undefined ? { fromRecipeCount: input.fromRecipeCount } : {}),
        ...(input.source !== undefined ? { source: input.source } : {}),
        sourceRecipeId: input.sourceRecipeId ?? null,
        sourceMealPlanEntryId: input.sourceMealPlanEntryId ?? null,
      },
    });
  }

  async update(
    id: string,
    userId: string,
    input: UpdateShoppingListItemInput,
  ): Promise<ShoppingListItemRecord | null> {
    const existing = await this.findById(id, userId);
    if (!existing) {
      return null;
    }
    const data: Prisma.ShoppingListItemUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.canonicalName !== undefined) data.canonicalName = input.canonicalName;
    if (input.quantity !== undefined) data.quantity = input.quantity;
    if (input.unit !== undefined) data.unit = input.unit;
    if (input.category !== undefined) data.category = input.category;
    if (input.emoji !== undefined) data.emoji = input.emoji;
    if (input.done !== undefined) data.done = input.done;
    if (input.fromRecipeCount !== undefined) data.fromRecipeCount = input.fromRecipeCount;
    if (input.source !== undefined) data.source = input.source;
    if (input.sourceRecipeId !== undefined) data.sourceRecipeId = input.sourceRecipeId;
    if (input.sourceMealPlanEntryId !== undefined) {
      data.sourceMealPlanEntryId = input.sourceMealPlanEntryId;
    }
    return this.db.shoppingListItem.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await this.db.shoppingListItem.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }

  async deleteDone(userId: string): Promise<number> {
    const result = await this.db.shoppingListItem.deleteMany({ where: { userId, done: true } });
    return result.count;
  }

  async deleteBySourceMealPlanEntryId(
    userId: string,
    sourceMealPlanEntryId: string,
  ): Promise<number> {
    const result = await this.db.shoppingListItem.deleteMany({
      where: { userId, sourceMealPlanEntryId },
    });
    return result.count;
  }
}
