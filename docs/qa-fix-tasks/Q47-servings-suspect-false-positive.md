# Q47. SERVINGS_SUSPECT fires on a normal 16-serving cake

🟡 Low · API · Found in the manual test of PR #20 (2026-10-18). Related to [Q04](Q04-ingredient-fidelity-and-groups.md).

## Problem

The King Arthur birthday cake (two 8-inch layers, 16 servings) gets the warning "16 servings is unusually many for a single dish". The chocolate chip cookies import with 48 servings and no warning, so the rule is inconsistent. Cakes, trays and cookie batches legitimately serve 12 to 24 or more.

## Root cause (verified)

`apps/api/src/modules/normalization/application/recipe-normalizer.ts` ~l.299 and ~l.317 emit `SERVINGS_SUSPECT` from a fixed threshold, with no regard to the recipe type or to what the source says.

## Fix

Skip the warning when the source states the number (yield text, JSON-LD `recipeYield`). Keep it for model-guessed servings, and raise the threshold for baked goods and batch dishes.

## Acceptance criteria

- The birthday cake and cookies import without `SERVINGS_SUSPECT`. A model-invented 40 servings for a pasta dish still warns.

## Tests

- `ingredient-fidelity.test.ts` or `extraction-core.test.ts`: a stated yield of 16 produces no warning; a guessed 40 does.
