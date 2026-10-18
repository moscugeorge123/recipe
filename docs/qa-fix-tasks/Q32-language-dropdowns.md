# Q32. App language and Recipe language should be dropdowns

🟡 Low · mobile · Finding **F89**

## Problem

Profile → Language lists every language as a row of pills (`APP_LANGUAGES.map`, `RECIPE_LANGUAGES.map` in `LanguageSection`, `tortie/screens/profile.tsx`). With 6 and 11 options the section is tall and wraps, and it will get worse as languages are added. The user wants a dropdown for each.

## Evidence

Reported by the product owner. Code: `LanguageSection` in `profile.tsx`.

## Root cause

Pill rows were fine for 2–3 options (Units uses them). There is no dropdown/select component in `tortie/ui`.

## Fix

1. Add `ui/select.tsx`: a row that shows the label, the current value and a chevron, and opens a small anchored menu on Android/iOS (or a bottom sheet with a radio list, reusing `Sheet`). Needs: keyboard/back-button close, selected tick, accessibility role `combobox`/`button` with the value announced, long-list scroll.
2. Replace both pill groups: **App language** (Device, English, Română, …) and **Recipe language** (As saved, then the 11 languages). Show each language in its own name (already how `APP_LANGUAGES` is written).
3. Keep Units as pills (two options).
4. Changing the recipe language keeps the existing confirmation or banner behaviour for re-translating recipes.
5. Labels come from `t()` ([Q30](Q30-app-translation-coverage.md)); the option names stay in their own language.

## Acceptance criteria

- Each setting is one row; tapping it opens the list; picking a value closes it and updates the row immediately.
- Works with TalkBack (announces name and value) and the Android back button closes the list first.
- The Language section is the same height regardless of the number of languages.

## Tests

- Jest: `Select` opens, selects, closes; selected option is marked.
- Manual: Pixel 6 and a 360 dp phone; dark text scale 130 %.
