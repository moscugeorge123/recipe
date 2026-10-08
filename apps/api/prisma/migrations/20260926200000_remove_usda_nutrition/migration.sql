-- Nutrition is now estimated by the recipe extractor (recipes.calories / recipes.nutrition).
-- Drops the USDA FoodData Central snapshot, match, and cache storage.

-- DropForeignKey
ALTER TABLE "nutrition_snapshots" DROP CONSTRAINT "nutrition_snapshots_recipeRevisionId_fkey";

-- DropForeignKey
ALTER TABLE "nutrition_food_matches" DROP CONSTRAINT "nutrition_food_matches_nutritionSnapshotId_fkey";

-- DropForeignKey
ALTER TABLE "nutrition_food_matches" DROP CONSTRAINT "nutrition_food_matches_revisionIngredientId_fkey";

-- DropForeignKey
ALTER TABLE "ai_usage" DROP CONSTRAINT "ai_usage_nutritionSnapshotId_fkey";

-- DropIndex
DROP INDEX "ai_usage_nutritionSnapshotId_idx";

-- AlterTable
ALTER TABLE "ai_usage" DROP COLUMN "nutritionSnapshotId";

-- DropTable
DROP TABLE "nutrition_food_matches";

-- DropTable
DROP TABLE "nutrition_snapshots";

-- DropTable
DROP TABLE "nutrition_query_cache";

-- DropTable
DROP TABLE "nutrition_food_cache";

-- DropEnum
DROP TYPE "NutritionStatus";
