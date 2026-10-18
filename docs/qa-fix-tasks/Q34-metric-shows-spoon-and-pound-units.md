# Q34. With Metric selected, tsp / tbsp / lb and similar still show

🟠 Medium · mobile (+ API) · Finding **F91** (extends F65–F67 in [Q16](Q16-units-and-scaling-in-method-text.md))

## Problem

Units set to **Metric** still show `tbsp`, `tsp`, `lb`, `cup`-style amounts. The unit setting should be applied everywhere an amount appears.

[Q16](Q16-units-and-scaling-in-method-text.md) covers step text and the editor and says ingredient rows convert correctly; that was only checked in the Imperial direction. This task covers the Metric direction and the other screens.

## Evidence

Reported by the product owner. Code review below; a list of the exact screens and recipes still needs a repro pass.

## Root cause

1. **Verified: spoons are never converted.** In `features/recipes/units.ts` `tsp` and `tbsp` are defined as `system: 'both'`, and `convertAmount()` returns `{ quantity, unit }` unchanged for `'both'`. Metric users therefore see `2 tbsp` instead of `30 ml`. (`cup` is imperial and is converted to ml.)
2. **Verified: fallbacks keep the source unit.** `ingredientAmount()` uses `ingredient.metric` and "falls back to the original" when it is missing, and `convertAmount()` is documented as covering "amounts the API didn't convert (cached payloads, grocery rows)". Where the API gave no metric view (the fallback path in [Q01](Q01-ingredient-units-and-ranges.md) loses the unit; recipes imported before dual measurements existed), the original `lb`/`tbsp` is shown. Alias coverage is partial (`lbs.`, `Tbs`, `T`, `c`, `stick`, `pinch`, "table spoon" are not in `ALIASES`), so `resolve()` returns null and the text is shown as it came.
3. **Verified (Q16): step text** and the pairs "100g (3.53 oz)" are baked by `addDualMeasurements()` on the API and only temperatures/lengths are reordered by `preferUnits()`.
4. **To check:** the same conversion on Groceries rows, the grocery picker (`grocery-pick.ts` defaults to `'metric'` when `opts.units` is missing), Cook mode "You'll need" chips, the editor, Today and the plan.

## Fix

1. Decide the rule for spoons: Metric means ml/g only. Convert `tsp` → 5 ml and `tbsp` → 15 ml (display "5 ml", "15 ml"; round 1 tsp = 5 ml, ½ tsp = 2.5 ml). Offer a Settings option **"Keep spoon measures"** only if the owner wants it, default off.
2. Add a single `formatAmount(quantity, unit, system)` used by every screen, so conversion is not copy-pasted (`groceries.ts` and `grocery-pick.ts` currently take `units` separately).
3. Extend the alias table (`tbs`, `tbsp.`, `T`, `tsp.`, `t`, `c`, `lbs.`, `fl. oz`, `pt`, `qt`, `gal`, `stick`) and make `resolve()` case- and punctuation-insensitive.
4. Where a unit cannot be converted (pinch, clove, "to taste") show it unchanged, never `piece`.
5. API: keep the dual values for every ingredient (finish [Q01](Q01-ingredient-units-and-ranges.md)) so the mobile fallback is rarely needed.
6. Step text: apply [Q16](Q16-units-and-scaling-in-method-text.md) item 1 or 2.

## Acceptance criteria

- Metric: no ingredient row, grocery row, cook chip, editor field or step text shows tsp, tbsp, cup, oz, lb or fl oz (except units with no metric equivalent).
- Imperial: no g/kg/ml/l except where no imperial form exists.
- Switching the setting updates open screens immediately.

## Tests

- Jest: `convertAmount` table (tsp/tbsp/cup/oz/lb/fl oz both ways, aliases, nulls); a screen-level test per consumer (ingredient rows, groceries, cook chips).
- Manual: a recipe that uses tbsp, cups and lb; groceries from it; both settings.
