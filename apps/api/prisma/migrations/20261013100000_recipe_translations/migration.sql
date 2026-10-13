-- CreateEnum
CREATE TYPE "RecipeTranslationStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "recipe_translations" (
    "id" UUID NOT NULL,
    "userRecipeId" UUID NOT NULL,
    "language" TEXT NOT NULL,
    "sourceRevisionId" UUID NOT NULL,
    "status" "RecipeTranslationStatus" NOT NULL DEFAULT 'PENDING',
    "content" JSONB,
    "error" TEXT,
    "promptVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recipe_translations_userRecipeId_language_key" ON "recipe_translations"("userRecipeId", "language");

-- AddForeignKey
ALTER TABLE "recipe_translations" ADD CONSTRAINT "recipe_translations_userRecipeId_fkey" FOREIGN KEY ("userRecipeId") REFERENCES "user_recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
