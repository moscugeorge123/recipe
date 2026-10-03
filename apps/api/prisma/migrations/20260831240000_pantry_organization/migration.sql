ALTER TABLE "pantry_items" ADD COLUMN "rawText" TEXT;
ALTER TABLE "pantry_items" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "pantry_items" ADD COLUMN "promptVersion" TEXT;
ALTER TABLE "pantry_items" ADD COLUMN "category" TEXT;
ALTER TABLE "pantry_items" ADD COLUMN "emoji" TEXT;
ALTER TABLE "pantry_items" ADD COLUMN "colorToken" TEXT;

UPDATE "pantry_items" SET "rawText" = "name" WHERE "rawText" IS NULL;

CREATE INDEX "pantry_items_userId_category_idx" ON "pantry_items"("userId", "category");
