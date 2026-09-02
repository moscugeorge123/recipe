-- Ingredient presentation is part of both the immutable import and every revision snapshot.
ALTER TABLE "recipe_ingredients"
  ADD COLUMN "emoji" TEXT NOT NULL DEFAULT '🥣',
  ADD COLUMN "colorToken" TEXT NOT NULL DEFAULT 'peach';

ALTER TABLE "recipe_revision_ingredients"
  ADD COLUMN "emoji" TEXT NOT NULL DEFAULT '🥣',
  ADD COLUMN "colorToken" TEXT NOT NULL DEFAULT 'peach';

-- Category names/slugs are copied into each revision so a later rename or delete cannot
-- change historical meaning. categoryId is informational and intentionally has no FK.
CREATE TABLE "recipe_revision_categories" (
  "id" UUID NOT NULL,
  "revisionId" UUID NOT NULL,
  "categoryId" UUID,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recipe_revision_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recipe_revision_categories_revisionId_slug_key"
  ON "recipe_revision_categories"("revisionId", "slug");
CREATE INDEX "recipe_revision_categories_revisionId_sortOrder_idx"
  ON "recipe_revision_categories"("revisionId", "sortOrder");
ALTER TABLE "recipe_revision_categories"
  ADD CONSTRAINT "recipe_revision_categories_revisionId_fkey"
  FOREIGN KEY ("revisionId") REFERENCES "recipe_revisions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Give pre-Agent-2 rows one deterministic default category and mirror it into revision 0.
WITH inferred AS (
  SELECT ur."id" AS "userRecipeId", ur."userId",
    CASE
      WHEN lower(r."title" || ' ' || coalesce(r."description", '')) ~
        '(cake|cookie|dessert|sweet|brownie|pudding|pie|tart)' THEN 'sweet'
      WHEN lower(r."title" || ' ' || coalesce(r."description", '')) ~
        '(breakfast|brunch|pancake|oat|omelette|omelet|cereal)' THEN 'breakfast'
      WHEN lower(r."title" || ' ' || coalesce(r."description", '')) ~
        '(lunch|sandwich|salad|wrap)' THEN 'lunch'
      ELSE 'dinner'
    END AS slug
  FROM "user_recipes" ur
  JOIN "recipes" r ON r."id" = ur."recipeId"
), selected AS (
  SELECT i.*, c."id" AS "categoryId", c."name", c."sortOrder"
  FROM inferred i
  JOIN "categories" c ON c."userId" = i."userId" AND c."slug" = i.slug
)
INSERT INTO "recipe_categories" ("userRecipeId", "categoryId", "userId")
SELECT "userRecipeId", "categoryId", "userId" FROM selected
ON CONFLICT DO NOTHING;

WITH selected AS (
  SELECT rr."id" AS "revisionId", c."id" AS "categoryId", c."slug", c."name", c."sortOrder"
  FROM "recipe_revisions" rr
  JOIN "user_recipes" ur ON ur."id" = rr."userRecipeId"
  JOIN "recipe_categories" rc ON rc."userRecipeId" = ur."id"
  JOIN "categories" c ON c."id" = rc."categoryId"
  WHERE rr."revisionNumber" = 0
)
INSERT INTO "recipe_revision_categories"
  ("id", "revisionId", "categoryId", "slug", "name", "sortOrder")
SELECT
  (
    substr(md5('revision-category:' || "revisionId"::text || ':' || slug), 1, 8) || '-' ||
    substr(md5('revision-category:' || "revisionId"::text || ':' || slug), 9, 4) || '-' ||
    substr(md5('revision-category:' || "revisionId"::text || ':' || slug), 13, 4) || '-' ||
    substr(md5('revision-category:' || "revisionId"::text || ':' || slug), 17, 4) || '-' ||
    substr(md5('revision-category:' || "revisionId"::text || ':' || slug), 21, 12)
  )::uuid,
  "revisionId", "categoryId", slug, name, "sortOrder"
FROM selected
ON CONFLICT DO NOTHING;

CREATE TRIGGER "recipe_revision_categories_immutable"
BEFORE UPDATE ON "recipe_revision_categories"
FOR EACH ROW EXECUTE FUNCTION reject_recipe_revision_update();
