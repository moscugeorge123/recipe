# Q43. "piece" unit shown on ingredients that have no quantity

🟠 Medium · API · Found in the manual test of PR #20 (2026-10-18). Related to [Q01](Q01-ingredient-units-and-ranges.md).

## Problem

BBC "Easy pancakes" stores `Lemon wedges` and `Caster sugar` with `quantity: null, unit: "piece"` (both optional). Sugar is not counted in pieces, and a bare "piece" reads like an amount. The same recipe stores `Large eggs` with `unit: "piece"`, which is inconsistent with "2 large eggs" elsewhere (unit null).

## Root cause (hypothesis)

`ingredient-normalizer.ts` (~l.71) already sets `unit = null` when `qty === null` and the unit is count-only, so the unit is put back later. Suspects: `reconcileMeasurements` (`measurement-conversion.ts`), or the model's `metric`/`imperial` fields carrying "1 piece" that reconcile copies over. Check by logging the ingredient after each step for the import of `https://www.bbcgoodfood.com/recipes/easy-pancakes`.

## Fix

Drop count-only units ("piece", "slice", ...) after reconciliation too when the final quantity is null. Prefer unit null for countable foods ("2 eggs").

## Acceptance criteria

- No stored ingredient has `unit = "piece"` with a null quantity.
- BBC "Easy pancakes" shows "Lemon wedges" and "Caster sugar" with no unit.

## Tests

- `ingredient-fidelity.test.ts`: an ingredient with null quantity and metric/imperial "1 piece" ends with unit null.
