-- Calories/macros are always produced by the extractor; nutritionSource says whether the
-- source stated them or the model estimated them. difficulty comes from the source/model.
-- Ingredients carry both a metric and an imperial amount; steps carry °C/°F and the
-- ingredient indexes they use.

-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "difficulty" TEXT,
ADD COLUMN     "nutritionSource" TEXT;

-- AlterTable
ALTER TABLE "recipe_revisions" ADD COLUMN     "difficulty" TEXT,
ADD COLUMN     "nutritionSource" TEXT;

-- AlterTable
ALTER TABLE "recipe_ingredients" ADD COLUMN     "imperialQuantity" DECIMAL(10,3),
ADD COLUMN     "imperialUnit" TEXT,
ADD COLUMN     "metricQuantity" DECIMAL(10,3),
ADD COLUMN     "metricUnit" TEXT;

-- AlterTable
ALTER TABLE "recipe_revision_ingredients" ADD COLUMN     "imperialQuantity" DECIMAL(10,3),
ADD COLUMN     "imperialUnit" TEXT,
ADD COLUMN     "metricQuantity" DECIMAL(10,3),
ADD COLUMN     "metricUnit" TEXT;

-- AlterTable
ALTER TABLE "recipe_steps" ADD COLUMN     "ingredientRefs" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "temperatureCelsius" INTEGER,
ADD COLUMN     "temperatureFahrenheit" INTEGER;

-- AlterTable
ALTER TABLE "recipe_revision_steps" ADD COLUMN     "ingredientRefs" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "temperatureCelsius" INTEGER,
ADD COLUMN     "temperatureFahrenheit" INTEGER;
