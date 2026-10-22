-- Part of the dish a step belongs to ("Make the sponge"), so a layered recipe's method reads in sections.

-- AlterTable
ALTER TABLE "recipe_steps" ADD COLUMN     "section" TEXT;

-- AlterTable
ALTER TABLE "recipe_revision_steps" ADD COLUMN     "section" TEXT;
