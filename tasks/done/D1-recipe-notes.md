# D1. Recipe notes (general and per step)

Group D: Other new features. Called "F1" in the prototype.

## Design source
- Spec: [DESIGN.md](../DESIGN.md), Group D › D1. Recipe notes (general and per step). Read it first. It is the design this task implements.
- Prototype: `Tortie App v2.dc.html`, screen: "Recipe notes", "Recipe" (Method section), "Cook mode". Search the file for `data-screen-label="..."`.

## Design
- The Notes row ([B3](B3-notes-row.md)) opens a **Recipe notes** sheet:
  - note list with relative date ("Today", "Yesterday", "3 days ago") and a "Step n" badge;
  - a composer with chips (General, Step 1…n);
  - Enter to send, Shift+Enter for a new line, a send/check button, and an "Editing note" state with cancel;
  - edit and delete per note.
- Steps show a note block, clamped to 2 lines, with "Show all n" / "Show less" and "Add" ([B4](B4-method-step-rows.md)).
- Cook mode shows the same notes on the intro (general) and on each step.

## Repo
- API exists: `RecipeNote` model, and `GET`/`POST /recipes/:id/notes`, `PATCH`/`DELETE .../notes/:noteId`.
- Mobile data layer exists: `features/recipes/hooks/use-recipe-notes.ts`, `stores/kitchen-store.ts`.
- **Done:** `RecipeNote.stepIndex` (zero-based, null = general) on the model, migration `20261012100000_recipe_note_step_index`, API and mobile schemas.
- **Done:** UI in `tortie/screens/recipe-notes.tsx` (Notes row, step note block, Recipe notes sheet), pure logic in `tortie/data/recipe-notes.ts` with tests. Cook mode shows general notes on the intro and step notes on each step; its Add opens the sheet above cook mode.
- Notes only exist for recipes saved to the account, so seed recipes show no row or blocks.
- Enter sends only on web; touch keyboards keep Enter as a line break and use the send button.

## Enrich later
- Cook-session notes (`cookSessionId`) versus recipe-level notes. The UI still creates recipe-level notes only.
- A step note keeps its index if steps are reordered or removed. The UI shows a note whose step is gone as a general note.
