-- DropIndex
DROP INDEX "user_recipes_latest_idx";

-- AlterTable
ALTER TABLE "cook_sessions" ALTER COLUMN "userId" SET DEFAULT '00000000-0000-4000-8000-000000000001';

-- CreateTable
CREATE TABLE "shopping_list_items" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "canonicalName" TEXT,
    "quantity" DECIMAL(10,3),
    "unit" TEXT,
    "category" TEXT,
    "emoji" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "fromRecipeCount" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceRecipeId" UUID,
    "sourceMealPlanEntryId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopping_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shopping_list_items_userId_done_updatedAt_idx" ON "shopping_list_items"("userId", "done", "updatedAt");

-- CreateIndex
CREATE INDEX "shopping_list_items_userId_canonicalName_idx" ON "shopping_list_items"("userId", "canonicalName");

-- CreateIndex
CREATE INDEX "user_recipes_latest_idx" ON "user_recipes"("userId", "createdAt", "id");

-- AddForeignKey
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
