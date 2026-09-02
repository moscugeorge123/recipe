import { Prisma, type PrismaClient, type NutritionStatus } from '@prisma/client';
import type { NutritionValues } from '@recipe/contracts';

import { NUTRIENT_KEYS } from '../../../modules/nutrition/domain/nutrients.js';
import type { FoodPortion, MatchedFood } from '../../../modules/nutrition/domain/types.js';

export interface NutritionSnapshotRecord {
  id: string;
  recipeRevisionId: string;
  status: NutritionStatus;
  servings: number | null;
  wholeRecipe: NutritionValues | null;
  perServing: NutritionValues | null;
  per100g: NutritionValues | null;
  coveragePercent: number | null;
  unmatchedIngredients: string[];
  provider: string | null;
  calculatedAt: Date | null;
  totalGrams: number | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  matches: NutritionMatchRecord[];
}

export interface NutritionMatchRecord {
  id: string;
  revisionIngredientId: string | null;
  query: string;
  matchedFoodId: string | null;
  matchedFoodName: string | null;
  confidence: number | null;
  grams: number | null;
  nutrients: NutritionValues | null;
}

export interface CreateNutritionSnapshotInput {
  recipeRevisionId: string;
  status: NutritionStatus;
  servings?: number | null;
  provider?: string;
}

export interface CompleteNutritionSnapshotInput {
  status: NutritionStatus;
  servings: number | null;
  wholeRecipe: NutritionValues | null;
  perServing: NutritionValues | null;
  per100g: NutritionValues | null;
  coveragePercent: number;
  unmatchedIngredients: string[];
  provider: string;
  calculatedAt: Date;
  totalGrams: number | null;
  failureReason: string | null;
  matches: Array<{
    revisionIngredientId: string | null;
    query: string;
    matchedFoodId: string | null;
    matchedFoodName: string | null;
    confidence: number | null;
    grams: number | null;
    nutrients: NutritionValues | null;
  }>;
}

export interface NutritionQueryCacheRecord {
  query: string;
  fdcId: string | null;
  matchedName: string | null;
  dataType: string | null;
}

export interface INutritionRepository {
  createSnapshot(input: CreateNutritionSnapshotInput): Promise<NutritionSnapshotRecord>;
  findSnapshotById(id: string): Promise<NutritionSnapshotRecord | null>;
  listSnapshotsForRevision(revisionId: string): Promise<NutritionSnapshotRecord[]>;
  updateSnapshotStatus(
    id: string,
    status: NutritionStatus,
    failureReason?: string | null,
  ): Promise<void>;
  completeSnapshot(id: string, input: CompleteNutritionSnapshotInput): Promise<NutritionSnapshotRecord>;
  findQueryCache(query: string): Promise<NutritionQueryCacheRecord | null>;
  upsertQueryCache(input: NutritionQueryCacheRecord): Promise<void>;
  findFoodCache(fdcId: string): Promise<MatchedFood | null>;
  upsertFoodCache(food: MatchedFood): Promise<void>;
  findRevisionIngredients(revisionId: string): Promise<
    Array<{
      id: string;
      name: string;
      canonicalName: string | null;
      quantity: Prisma.Decimal | null;
      unit: string | null;
    }>
  >;
  findRevisionMeta(revisionId: string): Promise<{
    id: string;
    servings: number | null;
    userId: string;
    recipeId: string;
  } | null>;
}

function asValues(value: Prisma.JsonValue | null): NutritionValues | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const result: NutritionValues = {};
  for (const key of NUTRIENT_KEYS) {
    const current = value[key];
    if (typeof current === 'number' && Number.isFinite(current)) {
      result[key] = current;
    }
  }
  return result;
}

function asStringArray(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function decimalToNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return Number(value);
}

function toSnapshot(
  row: Prisma.NutritionSnapshotGetPayload<{ include: { foodMatches: true } }>,
): NutritionSnapshotRecord {
  return {
    id: row.id,
    recipeRevisionId: row.recipeRevisionId,
    status: row.status,
    servings: decimalToNumber(row.servings),
    wholeRecipe: asValues(row.wholeRecipe),
    perServing: asValues(row.perServing),
    per100g: asValues(row.per100g),
    coveragePercent: decimalToNumber(row.coveragePercent),
    unmatchedIngredients: asStringArray(row.unmatchedIngredients),
    provider: row.provider,
    calculatedAt: row.calculatedAt,
    totalGrams: decimalToNumber(row.totalGrams),
    failureReason: row.failureReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    matches: row.foodMatches.map((match) => ({
      id: match.id,
      revisionIngredientId: match.revisionIngredientId,
      query: match.query,
      matchedFoodId: match.matchedFoodId,
      matchedFoodName: match.matchedFoodName,
      confidence: match.confidence,
      grams: decimalToNumber(match.grams),
      nutrients: asValues(match.nutrients),
    })),
  };
}

export class PrismaNutritionRepository implements INutritionRepository {
  constructor(private readonly db: PrismaClient) {}

  async createSnapshot(input: CreateNutritionSnapshotInput): Promise<NutritionSnapshotRecord> {
    const row = await this.db.nutritionSnapshot.create({
      data: {
        recipeRevisionId: input.recipeRevisionId,
        status: input.status,
        ...(input.servings !== undefined && input.servings !== null ? { servings: input.servings } : {}),
        ...(input.provider !== undefined ? { provider: input.provider } : {}),
      },
      include: { foodMatches: true },
    });
    return toSnapshot(row);
  }

  async findSnapshotById(id: string): Promise<NutritionSnapshotRecord | null> {
    const row = await this.db.nutritionSnapshot.findUnique({
      where: { id },
      include: { foodMatches: true },
    });
    return row ? toSnapshot(row) : null;
  }

  async listSnapshotsForRevision(revisionId: string): Promise<NutritionSnapshotRecord[]> {
    const rows = await this.db.nutritionSnapshot.findMany({
      where: { recipeRevisionId: revisionId },
      include: { foodMatches: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toSnapshot);
  }

  async updateSnapshotStatus(
    id: string,
    status: NutritionStatus,
    failureReason?: string | null,
  ): Promise<void> {
    await this.db.nutritionSnapshot.update({
      where: { id },
      data: {
        status,
        ...(failureReason !== undefined ? { failureReason } : {}),
      },
    });
  }

  async completeSnapshot(
    id: string,
    input: CompleteNutritionSnapshotInput,
  ): Promise<NutritionSnapshotRecord> {
    await this.db.nutritionFoodMatch.deleteMany({ where: { nutritionSnapshotId: id } });
    const row = await this.db.nutritionSnapshot.update({
      where: { id },
      data: {
        status: input.status,
        servings: input.servings,
        wholeRecipe: (input.wholeRecipe ?? Prisma.DbNull) as Prisma.InputJsonValue,
        perServing: (input.perServing ?? Prisma.DbNull) as Prisma.InputJsonValue,
        per100g: (input.per100g ?? Prisma.DbNull) as Prisma.InputJsonValue,
        coveragePercent: input.coveragePercent,
        unmatchedIngredients: input.unmatchedIngredients,
        provider: input.provider,
        calculatedAt: input.calculatedAt,
        totalGrams: input.totalGrams,
        failureReason: input.failureReason,
        foodMatches: {
          create: input.matches.map((match) => ({
            revisionIngredientId: match.revisionIngredientId,
            query: match.query,
            matchedFoodId: match.matchedFoodId,
            matchedFoodName: match.matchedFoodName,
            confidence: match.confidence,
            grams: match.grams,
            nutrients: (match.nutrients ?? Prisma.DbNull) as Prisma.InputJsonValue,
          })),
        },
      },
      include: { foodMatches: true },
    });
    return toSnapshot(row);
  }

  findQueryCache(query: string): Promise<NutritionQueryCacheRecord | null> {
    return this.db.nutritionQueryCache.findUnique({ where: { query } });
  }

  async upsertQueryCache(input: NutritionQueryCacheRecord): Promise<void> {
    await this.db.nutritionQueryCache.upsert({
      where: { query: input.query },
      create: {
        query: input.query,
        fdcId: input.fdcId,
        matchedName: input.matchedName,
        dataType: input.dataType,
      },
      update: {
        fdcId: input.fdcId,
        matchedName: input.matchedName,
        dataType: input.dataType,
      },
    });
  }

  async findFoodCache(fdcId: string): Promise<MatchedFood | null> {
    const row = await this.db.nutritionFoodCache.findUnique({ where: { fdcId } });
    if (!row) {
      return null;
    }
    return {
      fdcId: row.fdcId,
      name: row.foodName,
      dataType: row.dataType,
      nutrientsPer100g: asValues(row.nutrients) ?? {},
      portions: Array.isArray(row.portions)
        ? (row.portions as unknown as FoodPortion[])
        : [],
      confidence: 0.9,
    };
  }

  async upsertFoodCache(food: MatchedFood): Promise<void> {
    await this.db.nutritionFoodCache.upsert({
      where: { fdcId: food.fdcId },
      create: {
        fdcId: food.fdcId,
        foodName: food.name,
        dataType: food.dataType,
        nutrients: food.nutrientsPer100g as Prisma.InputJsonValue,
        portions: food.portions as unknown as Prisma.InputJsonValue,
      },
      update: {
        foodName: food.name,
        dataType: food.dataType,
        nutrients: food.nutrientsPer100g as Prisma.InputJsonValue,
        portions: food.portions as unknown as Prisma.InputJsonValue,
        fetchedAt: new Date(),
      },
    });
  }

  findRevisionIngredients(revisionId: string): Promise<
    Array<{
      id: string;
      name: string;
      canonicalName: string | null;
      quantity: Prisma.Decimal | null;
      unit: string | null;
    }>
  > {
    return this.db.recipeRevisionIngredient.findMany({
      where: { revisionId },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        canonicalName: true,
        quantity: true,
        unit: true,
      },
    });
  }

  async findRevisionMeta(revisionId: string): Promise<{
    id: string;
    servings: number | null;
    userId: string;
    recipeId: string;
  } | null> {
    const revision = await this.db.recipeRevision.findUnique({
      where: { id: revisionId },
      select: {
        id: true,
        servings: true,
        userRecipe: { select: { userId: true, recipeId: true } },
      },
    });
    if (!revision) {
      return null;
    }
    return {
      id: revision.id,
      servings: revision.servings,
      userId: revision.userRecipe.userId,
      recipeId: revision.userRecipe.recipeId,
    };
  }
}