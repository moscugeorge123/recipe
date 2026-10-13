-- Step titles are a short label; the instruction is the rest of the method.
-- ahead marks work that happens before the cooking session (soak, rest meat, marinate).
-- durationMinutes stays the cook timer and is only set when the cook waits.

ALTER TABLE "recipe_steps" ADD COLUMN "title" TEXT,
ADD COLUMN "ahead" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "recipe_revision_steps" ADD COLUMN "title" TEXT,
ADD COLUMN "ahead" BOOLEAN NOT NULL DEFAULT false;
