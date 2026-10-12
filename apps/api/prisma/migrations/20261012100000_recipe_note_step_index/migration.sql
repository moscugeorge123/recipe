-- A note can belong to one method step. NULL keeps it a general recipe note.

ALTER TABLE "recipe_notes" ADD COLUMN "stepIndex" INTEGER;
