import type { Prisma } from '@prisma/client';

export interface ShoppingListItemRecord {
  id: string;
  userId: string;
  name: string;
  canonicalName: string | null;
  quantity: Prisma.Decimal | null;
  unit: string | null;
  category: string | null;
  emoji: string | null;
  done: boolean;
  fromRecipeCount: number;
  source: string;
  sourceRecipeId: string | null;
  sourceMealPlanEntryId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateShoppingListItemInput {
  userId: string;
  name: string;
  canonicalName?: string | null;
  quantity?: Prisma.Decimal | null;
  unit?: string | null;
  category?: string | null;
  emoji?: string | null;
  done?: boolean;
  fromRecipeCount?: number;
  source?: string;
  sourceRecipeId?: string | null;
  sourceMealPlanEntryId?: string | null;
}

export interface UpdateShoppingListItemInput {
  name?: string;
  canonicalName?: string | null;
  quantity?: Prisma.Decimal | null;
  unit?: string | null;
  category?: string | null;
  emoji?: string | null;
  done?: boolean;
  fromRecipeCount?: number;
  source?: string;
  sourceRecipeId?: string | null;
  sourceMealPlanEntryId?: string | null;
}

export interface IShoppingListRepository {
  list(params: {
    userId: string;
    page: number;
    pageSize: number;
    done?: boolean;
  }): Promise<{ items: ShoppingListItemRecord[]; total: number }>;
  findById(id: string, userId: string): Promise<ShoppingListItemRecord | null>;
  findByCanonicalName(userId: string, canonicalName: string): Promise<ShoppingListItemRecord | null>;
  create(input: CreateShoppingListItemInput): Promise<ShoppingListItemRecord>;
  update(
    id: string,
    userId: string,
    input: UpdateShoppingListItemInput,
  ): Promise<ShoppingListItemRecord | null>;
  delete(id: string, userId: string): Promise<boolean>;
  deleteDone(userId: string): Promise<number>;
  deleteBySourceMealPlanEntryId(userId: string, sourceMealPlanEntryId: string): Promise<number>;
}
