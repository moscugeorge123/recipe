-- Recreate the enum so terminal sessions are COMPLETED or STOPPED, not FINISHED.
DROP INDEX IF EXISTS "cook_sessions_one_in_progress_per_recipe";

ALTER TABLE "cook_sessions" ALTER COLUMN "status" DROP DEFAULT;

CREATE TYPE "CookSessionStatus_new" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'STOPPED');

ALTER TABLE "cook_sessions"
  ALTER COLUMN "status" TYPE "CookSessionStatus_new"
  USING (
    CASE "status"::text
      WHEN 'FINISHED' THEN 'COMPLETED'
      ELSE "status"::text
    END
  )::"CookSessionStatus_new";

DROP TYPE "CookSessionStatus";

ALTER TYPE "CookSessionStatus_new" RENAME TO "CookSessionStatus";

ALTER TABLE "cook_sessions" ALTER COLUMN "status" SET DEFAULT 'IN_PROGRESS';

CREATE UNIQUE INDEX "cook_sessions_one_in_progress_per_recipe" ON "cook_sessions"("recipeId") WHERE status = 'IN_PROGRESS';
