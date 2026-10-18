# Q46. Brand names are lower-cased in ingredient names

🟡 Low · API · Found in the manual test of PR #20 (2026-10-18). Related to [Q03](Q03-title-casing-and-byline.md).

## Problem

King Arthur "Classic Birthday Cake" stores `King arthur unbleached all-purpose flour` and `King arthur pure vanilla extract (cake)`. Titles keep source casing now, but ingredient names still go through `toSentenceCase`.

## Root cause (verified)

`ingredient-normalizer.ts` ~l.90: `name: toSentenceCase(ingredient.name)` lower-cases everything after the first letter.

## Fix

Only sentence-case an ingredient name that is entirely lower-case or ALL CAPS; keep mixed-case names as the model returned them. Optionally drop the brand ("King Arthur") from the name.

## Acceptance criteria

- "King Arthur unbleached all-purpose flour" keeps its capitals; "wholemeal pitta" still becomes "Wholemeal pitta".

## Tests

- `casing.test.ts` / `ingredient-fidelity.test.ts`: mixed-case brand names are preserved.
