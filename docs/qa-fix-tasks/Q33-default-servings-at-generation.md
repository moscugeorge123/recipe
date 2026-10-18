# Q33. Default servings must be used when a recipe is generated

🟠 Medium · API + mobile · Finding **F90** (extends F61 in [Q18](Q18-dead-settings.md))

## Problem

The "Default servings" setting (Profile → Kitchen) must shape the recipes the user gets. Imported and generated recipes keep the source's servings (4, 12, 2, or a guess), so the setting has no effect.

[Q18](Q18-dead-settings.md) item 1 only proposes a display-side change: "the stepper on the detail view starts at `defaultServings`". The product owner asks for it at **generation time**, which is a different design.

## Evidence

Reported by the product owner. Previously seen in the QA pass: pancakes 12, guacamole 4, pasta 2 with the preference at 2 (F61).

## Root cause (verified in code)

* `prefs.defaultServings` is read only by Profile. The extraction request (`features/extraction/api.ts`) sends `url`, `forceRefresh`, `outputLanguage` and `options`; no servings.
* The extraction pipeline stores `servings` as the model returned it (and sometimes assumes a value, F40). Ingredient quantities are stored for that base.
* "Write it yourself" and Ask Tortie start from the editor's own base (`editor-draft.ts` `ed.base`), not the preference.

## Fix

Decide with the owner first: **A, scale at generation** (what was asked) or **B, scale on open** (Q18).

**A. Scale at generation (recommended)**
1. Send `targetServings` in `options` on `/recipes/extract` (and in the assist request).
2. Deterministic scaling on the API after normalisation, not by the model: keep the source servings in `sourceServings`, multiply every ingredient quantity by `target / source`, round with the existing `fmtQ` rules, leave "to taste/pinch" rows and unitless counts that must stay whole (eggs → nearest half or whole with a note), and set `servings = target`.
3. Step text with baked measurements needs the structured form from [Q16](Q16-units-and-scaling-in-method-text.md) item 1 to scale correctly; until then, show the "Amounts in the text are for N servings" note.
4. Keep the original: the recipe stores `sourceServings` so the user can scale back (detail screen shows "Scaled for 2 · original 12").
5. Dedupe ([Q27](Q27-duplicate-imports.md)) is per URL, so two users with different defaults would share one recipe row. Scale per user at read time (store source values; apply `targetServings` in the response), or treat servings as a per-user view. This is the reason **B-with-per-user-scale** may be cleaner.

**B. Scale on open**
Use `defaultServings` as the initial value of `useServings` (`recipe-detail.tsx`) and for cook mode and the grocery add; scale via the existing `ingQty(x, scale)`.

Either way: the `useServings` stepper still lets the user change it for one recipe.

## Acceptance criteria

- Default 2, import a 12-serving recipe: it shows 2 servings with scaled amounts and "original 12".
- Default 4: a new recipe written with Ask Tortie or "Write it yourself" starts at 4.
- Changing the default does not rewrite existing recipes (or, with B, only changes how they open).
- Scaling never produces "0.1 egg": whole-count items round sensibly.

## Tests

- Vitest: scaling table (12 → 2 pancakes, 4 → 6 guacamole, pinch/to taste, eggs, unitless counts).
- Jest: `useServings` initial value from the pref.
