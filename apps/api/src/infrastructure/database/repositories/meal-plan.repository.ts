import type { MealSlot, Prisma, PrismaClient } from '@prisma/client';

import type {
  CreateMealPlanEntryInput,
  IMealPlanRepository,
  MealPlanEntryRecord,
  MealPlanReorderUpdate,
  UpdateMealPlanEntryInput,
} from '../../../modules/meal-plan/repository/meal-plan.repository.js';

export class PrismaMealPlanRepository implements IMealPlanRepository {
  constructor(private readonly db: PrismaClient) {}

  listByDateRange(params: {
    userId: string;
    from: Date;
    to: Date;
  }): Promise<MealPlanEntryRecord[]> {
    return this.db.mealPlanEntry.findMany({
      where: {
        userId: params.userId,
        date: { gte: params.from, lte: params.to },
      },
      orderBy: [{ date: 'asc' }, { slot: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  findById(id: string, userId: string): Promise<MealPlanEntryRecord | null> {
    return this.db.mealPlanEntry.findFirst({ where: { id, userId } });
  }

  findManyByIds(ids: string[], userId: string): Promise<MealPlanEntryRecord[]> {
    return this.db.mealPlanEntry.findMany({
      where: { userId, id: { in: ids } },
    });
  }

  async maxSortOrder(userId: string, date: Date, slot: MealSlot): Promise<number> {
    const result = await this.db.mealPlanEntry.aggregate({
      where: { userId, date, slot },
      _max: { sortOrder: true },
    });
    return result._max.sortOrder ?? -1;
  }

  create(input: CreateMealPlanEntryInput): Promise<MealPlanEntryRecord> {
    return this.db.mealPlanEntry.create({
      data: {
        userId: input.userId,
        date: input.date,
        slot: input.slot,
        kind: input.kind,
        recipeId: input.recipeId ?? null,
        note: input.note ?? null,
        sortOrder: input.sortOrder,
      },
    });
  }

  async update(
    id: string,
    userId: string,
    input: UpdateMealPlanEntryInput,
  ): Promise<MealPlanEntryRecord | null> {
    const existing = await this.findById(id, userId);
    if (!existing) {
      return null;
    }
    const data: Prisma.MealPlanEntryUpdateInput = {};
    if (input.date !== undefined) data.date = input.date;
    if (input.slot !== undefined) data.slot = input.slot;
    if (input.note !== undefined) data.note = input.note;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    return this.db.mealPlanEntry.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await this.db.mealPlanEntry.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }

  async reorder(userId: string, updates: MealPlanReorderUpdate[]): Promise<MealPlanEntryRecord[]> {
    return this.db.$transaction(async (tx) => {
      const updated: MealPlanEntryRecord[] = [];
      for (const item of updates) {
        const row = await tx.mealPlanEntry.updateMany({
          where: { id: item.id, userId },
          data: {
            sortOrder: item.sortOrder,
            ...(item.date !== undefined ? { date: item.date } : {}),
            ...(item.slot !== undefined ? { slot: item.slot } : {}),
          },
        });
        if (row.count === 0) {
          continue;
        }
        const next = await tx.mealPlanEntry.findFirst({ where: { id: item.id, userId } });
        if (next) {
          updated.push(next);
        }
      }
      return updated;
    });
  }
}
