-- Deterministic identifiers used while the product has one implicit profile.
-- Future authentication can add users without changing the migrated owner's id.
-- singleton user: 00000000-0000-4000-8000-000000000001

-- CreateEnum
CREATE TYPE "RevisionSource" AS ENUM ('IMPORT', 'USER_EDIT', 'AI_ASSISTED', 'RESTORE', 'MIGRATION');
CREATE TYPE "RecipeReviewState" AS ENUM ('NEEDS_REVIEW', 'READY');
CREATE TYPE "NutritionStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED');
CREATE TYPE "PantryClassificationStatus" AS ENUM ('UNCLASSIFIED', 'PENDING', 'CLASSIFIED', 'NEEDS_REVIEW', 'FAILED');
CREATE TYPE "PantryStorageLocation" AS ENUM ('PANTRY', 'FRIDGE', 'FREEZER', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "profileKey" TEXT,
    "authSubject" TEXT,
    "email" TEXT,
    "displayName" TEXT,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_recipes" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "reviewState" "RecipeReviewState" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "rating" INTEGER,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_recipes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_recipes_rating_range" CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5))
);

CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recipe_categories" (
    "userRecipeId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recipe_categories_pkey" PRIMARY KEY ("userRecipeId", "categoryId")
);

CREATE TABLE "recipe_revisions" (
    "id" UUID NOT NULL,
    "userRecipeId" UUID NOT NULL,
    "authorUserId" UUID,
    "revisionNumber" INTEGER NOT NULL,
    "source" "RevisionSource" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "servings" INTEGER,
    "prepTimeMinutes" INTEGER,
    "cookTimeMinutes" INTEGER,
    "totalTimeMinutes" INTEGER,
    "calories" INTEGER,
    "cuisine" TEXT,
    "nutrition" JSONB,
    "sourceLanguage" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "promptVersion" TEXT,
    "rawExtraction" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recipe_revisions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "recipe_revisions_nonnegative_number" CHECK ("revisionNumber" >= 0)
);

CREATE TABLE "recipe_revision_ingredients" (
    "id" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "sourceId" UUID,
    "name" TEXT NOT NULL,
    "canonicalName" TEXT,
    "quantity" DECIMAL(10,3),
    "unit" TEXT,
    "preparation" TEXT,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT NOT NULL DEFAULT 'Pantry',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "provenance" JSONB NOT NULL DEFAULT '{}',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "recipe_revision_ingredients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recipe_revision_steps" (
    "id" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "sourceId" UUID,
    "stepOrder" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,
    "durationMinutes" INTEGER,
    "temperature" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'COOK',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "provenance" JSONB NOT NULL DEFAULT '{}',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    CONSTRAINT "recipe_revision_steps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recipe_notes" (
    "id" UUID NOT NULL,
    "userRecipeId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "recipe_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "collections" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "collection_recipes" (
    "collectionId" UUID NOT NULL,
    "userRecipeId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "collection_recipes_pkey" PRIMARY KEY ("collectionId", "userRecipeId")
);

CREATE TABLE "pantry_items" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "canonicalName" TEXT,
    "quantity" DECIMAL(10,3),
    "unit" TEXT,
    "storageLocation" "PantryStorageLocation" NOT NULL DEFAULT 'PANTRY',
    "expiresAt" TIMESTAMP(3),
    "classificationStatus" "PantryClassificationStatus" NOT NULL DEFAULT 'UNCLASSIFIED',
    "classification" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pantry_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pantry_items_nonnegative_quantity" CHECK ("quantity" IS NULL OR "quantity" >= 0)
);

CREATE TABLE "nutrition_snapshots" (
    "id" UUID NOT NULL,
    "recipeRevisionId" UUID NOT NULL,
    "status" "NutritionStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "servings" DECIMAL(10,3),
    "wholeRecipe" JSONB,
    "perServing" JSONB,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "nutrition_snapshots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "nutrition_snapshots_positive_servings" CHECK ("servings" IS NULL OR "servings" > 0)
);

CREATE TABLE "nutrition_food_matches" (
    "id" UUID NOT NULL,
    "nutritionSnapshotId" UUID NOT NULL,
    "revisionIngredientId" UUID,
    "query" TEXT NOT NULL,
    "matchedFoodId" TEXT,
    "matchedFoodName" TEXT,
    "confidence" DOUBLE PRECISION,
    "nutrients" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "nutrition_food_matches_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "nutrition_food_matches_confidence_range" CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1))
);

-- Existing rows are backfilled before userId becomes required.
ALTER TABLE "cook_sessions" ADD COLUMN "userId" UUID;

-- Extraction usage keeps its original job cascade; new operations may instead link to a profile
-- and one of the durable feature artifacts below.
ALTER TABLE "ai_usage" ALTER COLUMN "jobId" DROP NOT NULL;
ALTER TABLE "ai_usage"
    ADD COLUMN "userId" UUID,
    ADD COLUMN "recipeRevisionId" UUID,
    ADD COLUMN "pantryItemId" UUID,
    ADD COLUMN "nutritionSnapshotId" UUID;

-- SeedData
INSERT INTO "users" (
    "id", "profileKey", "displayName", "preferences", "createdAt", "updatedAt"
) VALUES (
    '00000000-0000-4000-8000-000000000001',
    'default',
    'My Kitchen',
    '{}',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

INSERT INTO "categories" ("id", "userId", "slug", "name", "sortOrder", "createdAt", "updatedAt") VALUES
    ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'breakfast', 'Breakfast', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'lunch', 'Lunch', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 'dinner', 'Dinner', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001', 'sweet', 'Sweet', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

UPDATE "cook_sessions"
SET "userId" = '00000000-0000-4000-8000-000000000001'
WHERE "userId" IS NULL;

ALTER TABLE "cook_sessions"
    ALTER COLUMN "userId" SET NOT NULL,
    ALTER COLUMN "userId" SET DEFAULT '00000000-0000-4000-8000-000000000001';

DROP INDEX "cook_sessions_one_in_progress_per_recipe";
CREATE UNIQUE INDEX "cook_sessions_one_in_progress_per_user_recipe"
ON "cook_sessions"("userId", "recipeId")
WHERE "status" = 'IN_PROGRESS';

-- md5 is built into PostgreSQL. Formatting its 32 hex characters as a UUID gives each
-- pre-existing row a deterministic id without requiring an extension.
INSERT INTO "user_recipes" ("id", "userId", "recipeId", "reviewState", "rating", "isFavorite", "createdAt", "updatedAt")
SELECT
    (
      substr(md5('user-recipe:' || r."id"::text), 1, 8) || '-' ||
      substr(md5('user-recipe:' || r."id"::text), 9, 4) || '-' ||
      substr(md5('user-recipe:' || r."id"::text), 13, 4) || '-' ||
      substr(md5('user-recipe:' || r."id"::text), 17, 4) || '-' ||
      substr(md5('user-recipe:' || r."id"::text), 21, 12)
    )::uuid,
    '00000000-0000-4000-8000-000000000001',
    r."id",
    'NEEDS_REVIEW',
    NULL,
    false,
    r."createdAt",
    r."updatedAt"
FROM "recipes" r;

-- Every current user recipe becomes original revision 0. Current recipe tables are left untouched, while the
-- revision copies preserve every value needed to reconstruct ingredients, steps and presentation.
INSERT INTO "recipe_revisions" (
    "id", "userRecipeId", "authorUserId", "revisionNumber", "source", "title", "description",
    "servings", "prepTimeMinutes", "cookTimeMinutes", "totalTimeMinutes", "calories", "cuisine",
    "nutrition", "sourceLanguage", "confidence", "warnings", "promptVersion", "rawExtraction", "createdAt"
)
SELECT
    (
      substr(md5('recipe-revision:' || ur."id"::text), 1, 8) || '-' ||
      substr(md5('recipe-revision:' || ur."id"::text), 9, 4) || '-' ||
      substr(md5('recipe-revision:' || ur."id"::text), 13, 4) || '-' ||
      substr(md5('recipe-revision:' || ur."id"::text), 17, 4) || '-' ||
      substr(md5('recipe-revision:' || ur."id"::text), 21, 12)
    )::uuid,
    ur."id",
    '00000000-0000-4000-8000-000000000001',
    0,
    'MIGRATION',
    r."title",
    r."description",
    r."servings",
    r."prepTimeMinutes",
    r."cookTimeMinutes",
    r."totalTimeMinutes",
    r."calories",
    r."cuisine",
    r."nutrition",
    r."sourceLanguage",
    r."confidence",
    r."warnings",
    r."promptVersion",
    r."rawExtraction",
    r."updatedAt"
FROM "user_recipes" ur
JOIN "recipes" r ON r."id" = ur."recipeId";

INSERT INTO "recipe_revision_ingredients" (
    "id", "revisionId", "sourceId", "name", "canonicalName", "quantity", "unit",
    "preparation", "optional", "category", "confidence", "provenance", "warnings", "sortOrder"
)
SELECT
    (
      substr(md5('revision-ingredient:' || i."id"::text), 1, 8) || '-' ||
      substr(md5('revision-ingredient:' || i."id"::text), 9, 4) || '-' ||
      substr(md5('revision-ingredient:' || i."id"::text), 13, 4) || '-' ||
      substr(md5('revision-ingredient:' || i."id"::text), 17, 4) || '-' ||
      substr(md5('revision-ingredient:' || i."id"::text), 21, 12)
    )::uuid,
    (
      substr(md5('recipe-revision:' || ur."id"::text), 1, 8) || '-' ||
      substr(md5('recipe-revision:' || ur."id"::text), 9, 4) || '-' ||
      substr(md5('recipe-revision:' || ur."id"::text), 13, 4) || '-' ||
      substr(md5('recipe-revision:' || ur."id"::text), 17, 4) || '-' ||
      substr(md5('recipe-revision:' || ur."id"::text), 21, 12)
    )::uuid,
    i."id",
    i."name",
    i."canonicalName",
    i."quantity",
    i."unit",
    i."preparation",
    i."optional",
    i."category",
    i."confidence",
    i."provenance",
    i."warnings",
    i."sortOrder"
FROM "recipe_ingredients" i
JOIN "user_recipes" ur ON ur."recipeId" = i."recipeId";

INSERT INTO "recipe_revision_steps" (
    "id", "revisionId", "sourceId", "stepOrder", "instruction", "durationMinutes",
    "temperature", "stage", "confidence", "provenance", "warnings"
)
SELECT
    (
      substr(md5('revision-step:' || s."id"::text), 1, 8) || '-' ||
      substr(md5('revision-step:' || s."id"::text), 9, 4) || '-' ||
      substr(md5('revision-step:' || s."id"::text), 13, 4) || '-' ||
      substr(md5('revision-step:' || s."id"::text), 17, 4) || '-' ||
      substr(md5('revision-step:' || s."id"::text), 21, 12)
    )::uuid,
    (
      substr(md5('recipe-revision:' || ur."id"::text), 1, 8) || '-' ||
      substr(md5('recipe-revision:' || ur."id"::text), 9, 4) || '-' ||
      substr(md5('recipe-revision:' || ur."id"::text), 13, 4) || '-' ||
      substr(md5('recipe-revision:' || ur."id"::text), 17, 4) || '-' ||
      substr(md5('recipe-revision:' || ur."id"::text), 21, 12)
    )::uuid,
    s."id",
    s."stepOrder",
    s."instruction",
    s."durationMinutes",
    s."temperature",
    s."stage",
    s."confidence",
    s."provenance",
    s."warnings"
FROM "recipe_steps" s
JOIN "user_recipes" ur ON ur."recipeId" = s."recipeId";

-- CreateIndex
CREATE UNIQUE INDEX "users_profileKey_key" ON "users"("profileKey");
CREATE UNIQUE INDEX "users_authSubject_key" ON "users"("authSubject");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "user_recipes_userId_recipeId_key" ON "user_recipes"("userId", "recipeId");
CREATE UNIQUE INDEX "user_recipes_id_userId_key" ON "user_recipes"("id", "userId");
CREATE INDEX "user_recipes_userId_updatedAt_idx" ON "user_recipes"("userId", "updatedAt");
CREATE INDEX "user_recipes_userId_reviewState_updatedAt_idx" ON "user_recipes"("userId", "reviewState", "updatedAt");
CREATE INDEX "user_recipes_userId_isFavorite_updatedAt_idx" ON "user_recipes"("userId", "isFavorite", "updatedAt");
CREATE INDEX "user_recipes_userId_rating_idx" ON "user_recipes"("userId", "rating");
CREATE UNIQUE INDEX "categories_userId_slug_key" ON "categories"("userId", "slug");
CREATE UNIQUE INDEX "categories_id_userId_key" ON "categories"("id", "userId");
CREATE INDEX "categories_userId_sortOrder_idx" ON "categories"("userId", "sortOrder");
CREATE INDEX "recipe_categories_userId_categoryId_idx" ON "recipe_categories"("userId", "categoryId");
CREATE UNIQUE INDEX "recipe_revisions_userRecipeId_revisionNumber_key" ON "recipe_revisions"("userRecipeId", "revisionNumber");
CREATE INDEX "recipe_revisions_userRecipeId_createdAt_idx" ON "recipe_revisions"("userRecipeId", "createdAt");
CREATE INDEX "recipe_revisions_authorUserId_idx" ON "recipe_revisions"("authorUserId");
CREATE UNIQUE INDEX "recipe_revision_ingredients_revisionId_sourceId_key" ON "recipe_revision_ingredients"("revisionId", "sourceId");
CREATE INDEX "recipe_revision_ingredients_revisionId_sortOrder_idx" ON "recipe_revision_ingredients"("revisionId", "sortOrder");
CREATE INDEX "recipe_revision_ingredients_canonicalName_idx" ON "recipe_revision_ingredients"("canonicalName");
CREATE UNIQUE INDEX "recipe_revision_steps_revisionId_stepOrder_key" ON "recipe_revision_steps"("revisionId", "stepOrder");
CREATE UNIQUE INDEX "recipe_revision_steps_revisionId_sourceId_key" ON "recipe_revision_steps"("revisionId", "sourceId");
CREATE INDEX "recipe_revision_steps_revisionId_idx" ON "recipe_revision_steps"("revisionId");
CREATE INDEX "recipe_notes_userRecipeId_updatedAt_idx" ON "recipe_notes"("userRecipeId", "updatedAt");
CREATE UNIQUE INDEX "collections_userId_name_key" ON "collections"("userId", "name");
CREATE INDEX "collections_userId_updatedAt_idx" ON "collections"("userId", "updatedAt");
CREATE INDEX "collection_recipes_userRecipeId_idx" ON "collection_recipes"("userRecipeId");
CREATE INDEX "pantry_items_userId_updatedAt_idx" ON "pantry_items"("userId", "updatedAt");
CREATE INDEX "pantry_items_userId_canonicalName_idx" ON "pantry_items"("userId", "canonicalName");
CREATE INDEX "pantry_items_userId_expiresAt_idx" ON "pantry_items"("userId", "expiresAt");
CREATE INDEX "nutrition_snapshots_recipeRevisionId_createdAt_idx" ON "nutrition_snapshots"("recipeRevisionId", "createdAt");
CREATE INDEX "nutrition_snapshots_status_updatedAt_idx" ON "nutrition_snapshots"("status", "updatedAt");
CREATE INDEX "nutrition_food_matches_nutritionSnapshotId_idx" ON "nutrition_food_matches"("nutritionSnapshotId");
CREATE INDEX "nutrition_food_matches_revisionIngredientId_idx" ON "nutrition_food_matches"("revisionIngredientId");
CREATE INDEX "cook_sessions_userId_updatedAt_idx" ON "cook_sessions"("userId", "updatedAt");
CREATE INDEX "ai_usage_userId_createdAt_idx" ON "ai_usage"("userId", "createdAt");
CREATE INDEX "ai_usage_recipeRevisionId_idx" ON "ai_usage"("recipeRevisionId");
CREATE INDEX "ai_usage_pantryItemId_idx" ON "ai_usage"("pantryItemId");
CREATE INDEX "ai_usage_nutritionSnapshotId_idx" ON "ai_usage"("nutritionSnapshotId");

-- Generalized AI usage must remain attached to either its original extraction job or a profile.
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_has_owner" CHECK ("jobId" IS NOT NULL OR "userId" IS NOT NULL);

-- AddForeignKey
ALTER TABLE "user_recipes" ADD CONSTRAINT "user_recipes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_recipes" ADD CONSTRAINT "user_recipes_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_categories" ADD CONSTRAINT "recipe_categories_userRecipeId_userId_fkey" FOREIGN KEY ("userRecipeId", "userId") REFERENCES "user_recipes"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_categories" ADD CONSTRAINT "recipe_categories_categoryId_userId_fkey" FOREIGN KEY ("categoryId", "userId") REFERENCES "categories"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_revisions" ADD CONSTRAINT "recipe_revisions_userRecipeId_fkey" FOREIGN KEY ("userRecipeId") REFERENCES "user_recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_revisions" ADD CONSTRAINT "recipe_revisions_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recipe_revision_ingredients" ADD CONSTRAINT "recipe_revision_ingredients_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "recipe_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_revision_steps" ADD CONSTRAINT "recipe_revision_steps_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "recipe_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_notes" ADD CONSTRAINT "recipe_notes_userRecipeId_fkey" FOREIGN KEY ("userRecipeId") REFERENCES "user_recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collections" ADD CONSTRAINT "collections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collection_recipes" ADD CONSTRAINT "collection_recipes_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collection_recipes" ADD CONSTRAINT "collection_recipes_userRecipeId_fkey" FOREIGN KEY ("userRecipeId") REFERENCES "user_recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pantry_items" ADD CONSTRAINT "pantry_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nutrition_snapshots" ADD CONSTRAINT "nutrition_snapshots_recipeRevisionId_fkey" FOREIGN KEY ("recipeRevisionId") REFERENCES "recipe_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nutrition_food_matches" ADD CONSTRAINT "nutrition_food_matches_nutritionSnapshotId_fkey" FOREIGN KEY ("nutritionSnapshotId") REFERENCES "nutrition_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nutrition_food_matches" ADD CONSTRAINT "nutrition_food_matches_revisionIngredientId_fkey" FOREIGN KEY ("revisionIngredientId") REFERENCES "recipe_revision_ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cook_sessions" ADD CONSTRAINT "cook_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_recipeRevisionId_fkey" FOREIGN KEY ("recipeRevisionId") REFERENCES "recipe_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_pantryItemId_fkey" FOREIGN KEY ("pantryItemId") REFERENCES "pantry_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_nutritionSnapshotId_fkey" FOREIGN KEY ("nutritionSnapshotId") REFERENCES "nutrition_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Revisions and their snapshot rows are append-only. Deletes remain available for parent cascades.
CREATE FUNCTION reject_recipe_revision_update() RETURNS trigger AS $$
BEGIN
    -- Removing an author during profile deletion does not mutate the immutable snapshot.
    IF TG_TABLE_NAME = 'recipe_revisions'
       AND (to_jsonb(NEW) - 'authorUserId') = (to_jsonb(OLD) - 'authorUserId') THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'recipe revisions are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "recipe_revisions_immutable"
BEFORE UPDATE ON "recipe_revisions"
FOR EACH ROW EXECUTE FUNCTION reject_recipe_revision_update();

CREATE TRIGGER "recipe_revision_ingredients_immutable"
BEFORE UPDATE ON "recipe_revision_ingredients"
FOR EACH ROW EXECUTE FUNCTION reject_recipe_revision_update();

CREATE TRIGGER "recipe_revision_steps_immutable"
BEFORE UPDATE ON "recipe_revision_steps"
FOR EACH ROW EXECUTE FUNCTION reject_recipe_revision_update();
