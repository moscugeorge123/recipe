-- Forward-only: calculation metadata, per-100g, coverage, and USDA match caches.
-- Does not rewrite the platform persistence foundation.

ALTER TABLE "nutrition_snapshots"
  ADD COLUMN "per100g" JSONB,
  ADD COLUMN "coveragePercent" DECIMAL(5,2),
  ADD COLUMN "unmatchedIngredients" JSONB,
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "calculatedAt" TIMESTAMP(3),
  ADD COLUMN "totalGrams" DECIMAL(12,3);

ALTER TABLE "nutrition_snapshots"
  ADD CONSTRAINT "nutrition_snapshots_coverage_range"
  CHECK ("coveragePercent" IS NULL OR ("coveragePercent" >= 0 AND "coveragePercent" <= 100));

ALTER TABLE "nutrition_snapshots"
  ADD CONSTRAINT "nutrition_snapshots_nonnegative_total_grams"
  CHECK ("totalGrams" IS NULL OR "totalGrams" >= 0);

ALTER TABLE "nutrition_food_matches"
  ADD COLUMN "grams" DECIMAL(12,3);

ALTER TABLE "nutrition_food_matches"
  ADD CONSTRAINT "nutrition_food_matches_nonnegative_grams"
  CHECK ("grams" IS NULL OR "grams" >= 0);

CREATE TABLE "nutrition_query_cache" (
    "id" UUID NOT NULL,
    "query" TEXT NOT NULL,
    "fdcId" TEXT,
    "matchedName" TEXT,
    "dataType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "nutrition_query_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "nutrition_query_cache_query_key" ON "nutrition_query_cache"("query");

CREATE TABLE "nutrition_food_cache" (
    "fdcId" TEXT NOT NULL,
    "foodName" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "nutrients" JSONB NOT NULL,
    "portions" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "nutrition_food_cache_pkey" PRIMARY KEY ("fdcId")
);
