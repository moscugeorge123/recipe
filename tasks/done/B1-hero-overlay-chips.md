# B1. Hero overlay chips replace the 3-stat tiles

Group B: Recipe page layout

## Design source
- Spec: [DESIGN.md](../DESIGN.md), Group B › B1. Hero overlay chips replace the 3-stat tiles. Read it first. It is the design this task implements.
- Prototype: `Tortie App v2.dc.html`, screen: "Recipe". Search the file for `data-screen-label="..."`.

## Design
- The three tiles (Total time / Level / Steps) below the title are **removed**.
- Frosted pills now sit on the hero photo, bottom-left, 30 px tall, wrapping:
  - `schedule` + time
  - `skillet` + level
  - `format_list_numbered` + "n steps"
  - `local_fire_department` + kcal per portion
- Pill style: `rgba(25,28,25,.58)`, blur 8, text #f8faf5, 13/700.

## Repo
- `screens/recipe-detail.tsx` (around lines 225-235) has the old three tiles ("Total time", "Level", icon `format_list_numbered`).
- The nutrition block exists separately.

## Enrich later
- Where kcal, kcal per 100 g and portion weight go now (README says a nutrition block).
- Behaviour when kcal is missing.
- Hero when there is no photo.

## Status
Done. The three tiles are removed. `HeroChips` in `screens/recipe-detail.tsx` draws the pills on the hero. The time, level and steps pills show when known, and the kcal pill shows when the recipe has calories. The nutrition block stays below the description, with its per-portion label and macros.
