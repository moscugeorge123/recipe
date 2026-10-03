import type { MealEntryKind, MealSlot } from '@prisma/client';

export interface MealPlanEntryRecord {
  id: string;
  userId: string;
  date: Date;
  slot: MealSlot;
  kind: MealEntryKind;
  recipeId: string | null;
  note: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMealPlanEntryInput {
  userId: string;
  date: Date;
  slot: MealSlot;
  kind: MealEntryKind;
  recipeId?: string | null;
  note?: string | null;
  sortOrder: number;
}

export interface UpdateMealPlanEntryInput {
  date?: Date;
  slot?: MealSlot;
  note?: string | null;
  sortOrder?: number;
}

export interface MealPlanReorderUpdate {
  id: string;
  date?: Date;
  slot?: MealSlot;
  sortOrder: number;
}

export interface IMealPlanRepository {
  listByDateRange(params: {
    userId: string;
    from: Date;
    to: Date;
  }): Promise<MealPlanEntryRecord[]>;
  findById(id: string, userId: string): Promise<MealPlanEntryRecord | null>;
  findManyByIds(ids: string[], userId: string): Promise<MealPlanEntryRecord[]>;
  maxSortOrder(userId: string, date: Date, slot: MealSlot): Promise<number>;
  create(input: CreateMealPlanEntryInput): Promise<MealPlanEntryRecord>;
  update(
    id: string,
    userId: string,
    input: UpdateMealPlanEntryInput,
  ): Promise<MealPlanEntryRecord | null>;
  delete(id: string, userId: string): Promise<boolean>;
  reorder(userId: string, updates: MealPlanReorderUpdate[]): Promise<MealPlanEntryRecord[]>;
}
