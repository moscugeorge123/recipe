-- Where a step starts in the source video. NULL means the step has no clip.
-- A clip ends where the next clip starts (or at the video's end), so only the start is stored.

ALTER TABLE "recipe_steps" ADD COLUMN "clipStartSeconds" INTEGER;

ALTER TABLE "recipe_revision_steps" ADD COLUMN "clipStartSeconds" INTEGER;
