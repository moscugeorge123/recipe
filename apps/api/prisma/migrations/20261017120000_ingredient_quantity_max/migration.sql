-- Upper bound of an ingredient amount range ("2 to 4 tablespoons"); quantity keeps the lower bound.

-- AlterTable
ALTER TABLE "recipe_ingredients" ADD COLUMN     "quantityMax" DECIMAL(10,3);

-- AlterTable
ALTER TABLE "recipe_revision_ingredients" ADD COLUMN     "quantityMax" DECIMAL(10,3);
