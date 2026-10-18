# Q30. The app is not fully translated into the selected language

🔴 High · mobile (+ API messages) · Finding **F87**

## Problem

Choosing a different **App language** in Profile (Română, Español, Français, Deutsch) changes only a few labels. Almost every screen stays in English.

## Evidence

Reported on a device; no screenshot.

## Root cause (verified in code)

The i18n layer exists (`src/i18n/index.ts`: `useT()`, `translate()`, `resolveAppLanguage()`; five languages in `languages.ts`) but is barely used:

* `src/i18n/messages.ts` has **~35 keys**: tab names, the Profile "Language/Units" rows and the translation banner.
* Only `tortie/screens/profile.tsx` (13 calls), `tortie/ui/translation-banner.tsx` (6) and `tortie/tab-bar.tsx` (1) call `t()`. The other ~45 files under `tortie/screens` and `tortie/ui` hard-code English in JSX (greetings, headings, buttons, empty states, toasts, sheet titles, onboarding, sign-in, cook mode, import copy).
* Other text that never goes through `t()`: date and weekday names (`DAYNAMES`, `todayLine`, `weekRange`), plurals (`plz()` in `tortie/lib/fmt.ts` only appends "s"), durations (`fmtT`: "min", "h"), toasts from `toast('…')`, Firebase/auth error text (`features/auth/errors.ts`), `user-error.ts` import messages, and strings that come back from the API (categories, `RECIPE_ASSIST_REJECTED`).
* There is no guard, so a new hard-coded string is never noticed.

## Fix

1. **Inventory.** Script (`scripts/i18n-audit.mjs`) that lists JSX text nodes, `placeholder`, `accessibilityLabel`, `title`/`label` props and `toast()` arguments that are string literals. That is the work list.
2. **Move strings to keys, screen by screen**, in the order users meet them: sign-in/onboarding → Today → Cookbook → recipe detail → cook mode → Plan → Groceries → Profile → sheets → toasts and errors. One PR per area.
3. **Formatting helpers become locale-aware:** `Intl.DateTimeFormat`/`Intl.RelativeTimeFormat` for dates, `Intl.PluralRules` for plurals (Romanian has three forms), `Intl.NumberFormat` for numbers and fractions, and localised unit labels (min/h, g, ml, tsp). Replace `plz()`.
4. **API-originated text:** return stable error codes and map them to local keys (`importFailureToast`, `RECIPE_ASSIST_REJECTED`, validation errors) instead of showing server English. Where the server must write text for the user, see [Q31](Q31-recipe-language-in-ai-responses.md).
5. **Typing:** `MessageKey` is already a union, so a missing translation is a compile error. Keep `en` as the base and fall back to it at runtime.
6. **Guard:** the audit script runs in CI and fails when a new literal appears outside an allow-list (brand names, dev-only strings).
7. Fold the rename in [Q29](Q29-rename-method-to-steps.md) into this: add `recipe.tab.steps` rather than editing the English literal.
8. Translation quality: Romanian and the other four are written by hand in `messages.ts`; have a native speaker review before release.

## Acceptance criteria

- With the device in English and the app set to Română, every visible string on Today, Cookbook, recipe detail, cook mode, Plan, Groceries, Profile, Imports and all sheets is Romanian, including dates, plurals and toasts. Repeat for one more language.
- The audit script reports zero un-keyed strings in `tortie/screens` and `tortie/ui`.
- Changing the language updates open screens without a restart.
- Recipe content (titles, steps) follows the **recipe** language, not the app language ([Q31](Q31-recipe-language-in-ai-responses.md)).

## Tests

- Jest: every `MessageKey` exists in every language (type-checked) and placeholders match between languages.
- Jest: plural and date helpers for `ro` (1 / 2 / 20 / 100) and `en`.
- Manual: walk the app in `ro` with the audit's screenshot checklist.
