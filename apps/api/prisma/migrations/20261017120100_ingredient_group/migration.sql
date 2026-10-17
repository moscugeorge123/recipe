-- Ingredient list heading ("For the buttercream"), so repeated names stay distinguishable.

-- AlterTable
ALTER TABLE "recipe_ingredients" ADD COLUMN     "group" TEXT;

-- AlterTable
ALTER TABLE "recipe_revision_ingredients" ADD COLUMN     "group" TEXT;
