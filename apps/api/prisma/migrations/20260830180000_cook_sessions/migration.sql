-- CreateEnum
CREATE TYPE "CookSessionStatus" AS ENUM ('IN_PROGRESS', 'FINISHED');

-- CreateTable
CREATE TABLE "cook_sessions" (
    "id" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "status" "CookSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cook_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cook_sessions_status_updatedAt_idx" ON "cook_sessions"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "cook_sessions_recipeId_idx" ON "cook_sessions"("recipeId");

-- One in-progress session per recipe (finished history is unbounded).
CREATE UNIQUE INDEX "cook_sessions_one_in_progress_per_recipe" ON "cook_sessions"("recipeId") WHERE status = 'IN_PROGRESS';

-- AddForeignKey
ALTER TABLE "cook_sessions" ADD CONSTRAINT "cook_sessions_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
