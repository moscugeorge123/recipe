-- AlterTable
ALTER TABLE "recipes" ADD COLUMN "cuisine" TEXT;
ALTER TABLE "recipes" ADD COLUMN "nutrition" JSONB;
ALTER TABLE "recipe_ingredients" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'Pantry';
ALTER TABLE "recipe_steps" ADD COLUMN "stage" TEXT NOT NULL DEFAULT 'COOK';
