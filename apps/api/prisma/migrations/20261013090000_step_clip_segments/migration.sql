-- A step's clip becomes a list of ranges in the source video: [{ "start": 12.5, "end": 31 }].
-- A step can have several ranges when the video comes back to it. Empty list = no clip.

ALTER TABLE "recipe_steps" ADD COLUMN "clipSegments" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "recipe_revision_steps" ADD COLUMN "clipSegments" JSONB NOT NULL DEFAULT '[]';

-- Carry existing start times over: each clip ran until the next clip started. The last one
-- gets 30 seconds, the same fallback the app used when the video length was unknown.
WITH ranked AS (
  SELECT
    "id",
    "clipStartSeconds" AS "start",
    LEAD("clipStartSeconds") OVER (PARTITION BY "recipeId" ORDER BY "clipStartSeconds", "stepOrder") AS "next"
  FROM "recipe_steps"
  WHERE "clipStartSeconds" IS NOT NULL
)
UPDATE "recipe_steps" AS s
SET "clipSegments" = jsonb_build_array(
  jsonb_build_object('start', r."start", 'end', COALESCE(r."next", r."start" + 30))
)
FROM ranked AS r
WHERE s."id" = r."id" AND COALESCE(r."next", r."start" + 30) > r."start";

WITH ranked AS (
  SELECT
    "id",
    "clipStartSeconds" AS "start",
    LEAD("clipStartSeconds") OVER (PARTITION BY "revisionId" ORDER BY "clipStartSeconds", "stepOrder") AS "next"
  FROM "recipe_revision_steps"
  WHERE "clipStartSeconds" IS NOT NULL
)
UPDATE "recipe_revision_steps" AS s
SET "clipSegments" = jsonb_build_array(
  jsonb_build_object('start', r."start", 'end', COALESCE(r."next", r."start" + 30))
)
FROM ranked AS r
WHERE s."id" = r."id" AND COALESCE(r."next", r."start" + 30) > r."start";

ALTER TABLE "recipe_steps" DROP COLUMN "clipStartSeconds";
ALTER TABLE "recipe_revision_steps" DROP COLUMN "clipStartSeconds";
