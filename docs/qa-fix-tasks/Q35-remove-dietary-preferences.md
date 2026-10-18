# Q35. Remove dietary preferences

🟡 Low · mobile · Finding **F92** (resolves the diet half of [Q18](Q18-dead-settings.md): F61, F62)

## Problem

"Dietary preferences" (Profile → Kitchen) saves a choice nothing reads, and every new account starts with **Vegetarian** on. The product owner decided to remove the feature instead of building it. This was the "or remove the row" option in Q18.

## Evidence

[Q18](Q18-dead-settings.md) and `077-profile.png`. Code: `profile.tsx` (`DIETS`, the row at ~l.717–750), `prefs-store.ts` (`diet: { veg: true }`, `DietKey`).

## What to remove

1. The Dietary preferences row and the `DIETS` list in `tortie/screens/profile.tsx`, and the `DietKey` import.
2. `diet` and `DietKey` from `tortie/prefs-store.ts`. Bump the persist `version` and add a `migrate` that drops `diet` from stored prefs, so old installs do not carry it.
3. Any i18n keys for it ([Q30](Q30-app-translation-coverage.md)) and the "flags recipes that don't fit" copy in docs and onboarding.
4. Q18's acceptance line "New account: no diet selected" becomes moot; update Q18 and mark the diet items done there.

## Decide

* The Cookbook **Vegetarian** filter chip is separate, hard-coded and keeps working; nothing here touches it. Confirm the owner wants it kept.
* Ask Tortie and the extractor receive no diet; nothing to change on the API.

## Acceptance criteria

- No dietary UI anywhere; `grep -rn "diet" apps/mobile/src` returns only the Cookbook filter and the migration.
- Existing installs open without errors and without the stored value.
- The guard test proposed in Q18 (every `prefs.*` key has a consumer outside Profile) passes for the remaining keys, which also covers `defaultServings` ([Q33](Q33-default-servings-at-generation.md)).

## Tests

- Jest: prefs migration drops `diet`; Profile renders without it.
