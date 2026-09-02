import type { Prisma, PrismaClient } from '@prisma/client';

import type { OpsSummary } from '../api/ops.schema.js';

const USDA_429_LOG_FILTER = 'NutritionRateLimitError OR step=nutrition.process status=429';
const REVISION_CONFLICT_LOG_FILTER = 'error.code=RECIPE_REVISION_CONFLICT';

const EXTRACTION_TERMINAL = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);
const NUTRITION_IN_FLIGHT = new Set(['PENDING', 'PROCESSING']);

interface MigrationRow {
  migration_name: string;
  finished_at: Date | null;
}

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundCost(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function countsByStatus(
  rows: Array<{ status: string; _count: { _all: number } }>,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.status] = row._count._all;
  }
  return result;
}

function classificationSource(value: Prisma.JsonValue): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const source = value['source'];
  return typeof source === 'string' ? source : undefined;
}

export class OpsSummaryService {
  constructor(private readonly db: PrismaClient) {}

  async getSummary(userId: string): Promise<OpsSummary> {
    const [
      aiTotals,
      aiByOperation,
      queryCacheEntries,
      foodCacheEntries,
      nutritionByStatus,
      pantryItems,
      revisionCount,
      extractionByStatus,
      migrations,
    ] = await Promise.all([
      this.db.aIUsage.aggregate({
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true },
      }),
      this.db.aIUsage.groupBy({
        by: ['operation', 'model'],
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true },
        orderBy: [{ operation: 'asc' }, { model: 'asc' }],
      }),
      this.db.nutritionQueryCache.count(),
      this.db.nutritionFoodCache.count(),
      this.db.nutritionSnapshot.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.db.pantryItem.findMany({
        where: { userId },
        select: { classification: true },
      }),
      this.db.recipeRevision.count({
        where: { userRecipe: { userId } },
      }),
      this.db.extractionJob.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.readMigrations(),
    ]);

    const nutritionCounts = countsByStatus(nutritionByStatus);
    const extractionCounts = countsByStatus(extractionByStatus);
    const fallbackItems = pantryItems.filter(
      (item) => classificationSource(item.classification) === 'fallback',
    ).length;
    const pantryCount = pantryItems.length;
    const cacheCalls = aiByOperation
      .filter((row) => row.operation.includes('cache'))
      .reduce((sum, row) => sum + row._count._all, 0);
    const escalationCalls = aiByOperation
      .filter((row) => row.operation.includes('escalation'))
      .reduce((sum, row) => sum + row._count._all, 0);

    let nutritionInFlight = 0;
    for (const status of NUTRITION_IN_FLIGHT) {
      nutritionInFlight += nutritionCounts[status] ?? 0;
    }
    const extractionInFlight = Object.entries(extractionCounts)
      .filter(([status]) => !EXTRACTION_TERMINAL.has(status))
      .reduce((sum, [, count]) => sum + count, 0);

    return {
      generatedAt: new Date().toISOString(),
      profileScoped: true,
      ai: {
        calls: aiTotals._count._all,
        inputTokens: aiTotals._sum.inputTokens ?? 0,
        outputTokens: aiTotals._sum.outputTokens ?? 0,
        estimatedCostUsd: roundCost(decimalToNumber(aiTotals._sum.estimatedCostUsd)),
        cacheCalls,
        escalationCalls,
        byOperation: aiByOperation.map((row) => ({
          operation: row.operation,
          model: row.model,
          calls: row._count._all,
          inputTokens: row._sum.inputTokens ?? 0,
          outputTokens: row._sum.outputTokens ?? 0,
          estimatedCostUsd: roundCost(decimalToNumber(row._sum.estimatedCostUsd)),
        })),
      },
      usda: {
        queryCacheEntries,
        foodCacheEntries,
        rateLimitedPersisted: false,
        rateLimitedLogFilter: USDA_429_LOG_FILTER,
      },
      nutrition: {
        byStatus: nutritionCounts,
        failed: nutritionCounts['FAILED'] ?? 0,
        inFlight: nutritionInFlight,
      },
      pantry: {
        items: pantryCount,
        fallbackItems,
        fallbackRate: pantryCount === 0 ? 0 : fallbackItems / pantryCount,
      },
      revisions: {
        count: revisionCount,
        conflictsPersisted: false,
        conflictLogFilter: REVISION_CONFLICT_LOG_FILTER,
      },
      queues: {
        extractionByStatus: extractionCounts,
        extractionInFlight,
        nutritionInFlight,
      },
      migrations,
    };
  }

  private async readMigrations(): Promise<OpsSummary['migrations']> {
    try {
      const rows = await this.db.$queryRaw<MigrationRow[]>`
        SELECT "migration_name", "finished_at"
        FROM "_prisma_migrations"
        WHERE "finished_at" IS NOT NULL
        ORDER BY "finished_at" DESC
      `;
      const latest = rows[0];
      return {
        applied: rows.length,
        lastApplied: latest?.migration_name ?? null,
      };
    } catch {
      return { applied: 0, lastApplied: null };
    }
  }
}
