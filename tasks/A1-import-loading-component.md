# A1. New import loading component (live "recipe being built" card)

Group A: Import experience

**Status: done.** New card in `tortie/ui/import-progress.tsx` (orb, five stages, scan beam, chips, step rows, strip) and `tortie/ui/import-done.tsx`. Chips and step rows are placeholders that fill by progress, because the API sends no partial recipe.

## Design source
- Spec: [DESIGN.md](DESIGN.md), Group A › A1. New import loading component. Read it first. It is the design this task implements.
- Prototype: `Tortie App v2.dc.html`, screen: Add a recipe sheet (importing and done states). Search the file for `data-screen-label="..."`.

## Design (Add a recipe sheet, importing state)
- **Header:** a 40 px conic "orb", a shimmering stage label, and a percentage.
- **Five stages, switched by progress:**
  - 0%: Reading the page
  - 18%: Grabbing the photo
  - 34%: Picking out ingredients
  - 66%: Writing the steps
  - 94%: Plating it up
- **Preview card:**
  - The photo area shows a terracotta **scan beam** (`tortieScan`) while progress is under 22%, with the source chip (platform logo and host).
  - Title ("Sicilian Caponata"), a meta line, ingredient **chips** that fill in, and step rows with their own progress.
  - A progress strip at the bottom.
- **Done state:** a pop-in tile with sparkles, an "Added to Cookbook" card, a source line and an **Open recipe** button.

## Repo
- `tortie/ui/import-progress.tsx` has the older stage list ("Reading the page" … "Wrote N steps").
- `screens/add-recipe.tsx` holds the idle, importing and done states.
- `features/extraction/*` drives the job: `use-extraction-job.ts`, `stage-map.ts`.

## Enrich later
- Which real extraction data feeds the chips and steps (partial results, or placeholders until the job finishes).
- Map the five stages to the real pipeline stages (acquire, media, transcribe, vision, OCR, extract, normalize, validate).
- The `tortieScan` animation needs a Reanimated port.
