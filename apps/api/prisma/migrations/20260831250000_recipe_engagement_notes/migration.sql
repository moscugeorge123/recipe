ALTER TABLE "user_recipes" ADD COLUMN "completedCookCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "user_recipes"
  ADD CONSTRAINT "user_recipes_completedCookCount_nonnegative"
  CHECK ("completedCookCount" >= 0);

UPDATE "user_recipes" AS ur
SET "completedCookCount" = sub.cnt
FROM (
  SELECT cs."userId", cs."recipeId", COUNT(*)::int AS cnt
  FROM "cook_sessions" AS cs
  WHERE cs."status" = 'COMPLETED'
  GROUP BY cs."userId", cs."recipeId"
) AS sub
WHERE ur."userId" = sub."userId"
  AND ur."recipeId" = sub."recipeId";

ALTER TABLE "recipe_notes" ADD COLUMN "cookSessionId" UUID;

ALTER TABLE "recipe_notes"
  ADD CONSTRAINT "recipe_notes_cookSessionId_fkey"
  FOREIGN KEY ("cookSessionId") REFERENCES "cook_sessions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "recipe_notes_cookSessionId_idx" ON "recipe_notes"("cookSessionId");

CREATE INDEX "user_recipes_latest_idx"
  ON "user_recipes"("userId", "createdAt" DESC, "id" ASC);

CREATE INDEX "user_recipes_engagement_idx"
  ON "user_recipes"(
    "userId",
    "isFavorite" DESC,
    "completedCookCount" DESC,
    "updatedAt" DESC,
    "id" ASC
  );

CREATE INDEX "cook_sessions_userId_recipeId_status_idx"
  ON "cook_sessions"("userId", "recipeId", "status");
