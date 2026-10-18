# QA fix tasks (manual test pass, 2026-10-17)

Source: a manual end-to-end test of the Android app (Pixel 6 emulator, dev client `com.tortie.com`, API + worker + fresh Postgres, real OpenAI/Apify keys), including recipe imports **through the Android share intent**. The full findings list is [QA_REPORT.md](QA_REPORT.md). The screenshots are in [screenshots/](screenshots/) and every task embeds the ones that prove its problem.

Each task is self-contained: **Problem → Evidence → Root cause → Fix → Acceptance criteria → Tests**. Root causes marked **verified** were traced in the code. Those marked **hypothesis** list a cheap experiment to confirm before coding.

Finding IDs (`F15`, `F09`, …) match [QA_REPORT.md](QA_REPORT.md).

## Read this first

* **Branch base:** `feat/firebase-auth` @ `d2f2b90`. The test ran against that commit **plus the uncommitted work in the main worktree**. These files exist only in that uncommitted work and are not in this branch: `tortie/ui/empty-state.tsx`, `tortie/ui/first-recipe.tsx`, `tortie/screens/welcome.tsx`, and edits to `cookbook.tsx`, `plan.tsx`, `profile.tsx`, `today.tsx`, `shell.tsx`, `prefs-store.ts`, `recipes.ts`. Tasks that touch them say so (⚠ **WIP**). Land that work first, or rebase this branch onto it. Line numbers differ slightly between the two, so tasks cite file and symbol names.
* **Corrections to the first report** (found while tracing code for these tasks):
  * F65: `preferUnits` already reorders *temperature and length* pairs ("180°C (350°F)") for imperial users. It does **not** handle mass or volume pairs ("100g (3.53 oz)"). So the claim holds for g/ml/oz/tbsp only, and the "method text is not converted/scaled" part was **derived from the code, not observed on screen** ([Q16](Q16-units-and-scaling-in-method-text.md) starts with a 5-minute check).
  * F36: the lower-casing is not YouTube-specific. `toSentenceCase()` lower-cases every title (the web import "The Best Guacamole Recipe" became "The best guacamole recipe"). It only *looks* fine on titles that were already sentence case ([Q03](Q03-title-casing-and-byline.md)).
  * F58: grocery auto-fill is **deliberate backend behaviour** (`meal-plan-service.ts` calls `shoppingListService.addFromRecipe` when an entry is created). The mobile copy contradicts it ([Q17](Q17-groceries-plan-sync-copy.md)).
* The test account `qa.tortie.test1@example.com` was created in the real Firebase project `tortie-recipe`; delete it when done.
* **Re-testing:** the emulator + Metro + API/worker setup is described in [QA_REPORT.md §1](QA_REPORT.md). Use `adb shell am start -a android.intent.action.SEND -t text/plain --es android.intent.extra.TEXT '<url>' -n com.tortie.com/.MainActivity` to exercise the share flow. Quote the whole text with single quotes inside `adb shell "..."` or spaces split it.

**Running tasks with agents:** see [AGENT-GROUPS.md](AGENT-GROUPS.md), which regroups all tasks by code area (one agent per area) and shows which groups can run in parallel.

## Index

Severity: 🔴 high · 🟠 medium · 🟡 low. Tick the box when the task is done.

### Group A: Imported recipe quality (API)
- [ ] 🔴 [Q01. Keep units and ranges when the model puts them in `quantity`](Q01-ingredient-units-and-ranges.md) (F15, F42, F44)
- [ ] 🔴 [Q02. Step order and step title/body split](Q02-step-order-and-title-split.md) (F39, F69, F25, F29)
- [ ] 🟠 [Q03. Title casing and the "by Website" byline](Q03-title-casing-and-byline.md) (F36, F19)
- [ ] 🟠 [Q04. Ingredient fidelity, groups, servings and validation noise](Q04-ingredient-fidelity-and-groups.md) (F37, F40, F41, F75, F17)
- [ ] 🟠 [Q05. Blocked sites, slow failures and low-res thumbnails](Q05-site-access-and-failures.md) (F73, F74, F43)
- [ ] 🟡 [Q06. Meal-type tag and the "Tonight's dinner" hero](Q06-meal-type-and-tonight-hero.md) (F21, F38, F54)

### Group B: Import flow and Share-from-another-app
- [ ] 🔴 [Q07. Import progress must reflect the real job](Q07-import-progress-truthful.md) (F72, F46, F45, F34)
- [ ] 🟠 [Q08. Advertised vs supported sources; preview and error copy](Q08-supported-sources-and-error-copy.md) (F50, F05, F12, F47, F52, F53)
- [ ] 🟠 [Q09. Toasts: overlap, truncation and a stuck toast](Q09-toasts.md) (F51, F79)
- [ ] 🟡 [Q10. YouTube letter-boxed thumbnails](Q10-letterboxed-thumbnails.md) (F33, F37, F56)
- [ ] 🟡 [Q11. Dev placeholder text in the UI](Q11-placeholder-text.md) (F18)

### Group C: UI defects
- [ ] 🔴 [Q12. Last word of serif headings is dropped](Q12-heading-last-word-clipped.md) (F09)
- [ ] 🟠 [Q13. Keyboard covers the sign-in success screen; wording](Q13-signin-success-screen.md) (F02, F03, F04, F01)
- [ ] 🟡 [Q14. Icon names missing from the bundled fonts](Q14-icon-glyphs.md) (F08, F63)
- [ ] 🟡 [Q15. Cookbook state, subtitle and plural](Q15-cookbook-state-and-copy.md) (F76, F70, F13)
- [ ] 🟡 [Q19. Detail, editor and cook-mode polish](Q19-detail-editor-cook-polish.md) (F23, F68, F30, F28, F29, F31, F32, F10)

### Group D: Settings, units, plan and groceries
- [ ] 🔴 [Q18. Settings that do nothing; "Vegetarian" is on by default](Q18-dead-settings.md) (F61, F62, F64)
- [ ] 🟠 [Q16. Units and scaling in method text; editor unit leak](Q16-units-and-scaling-in-method-text.md) (F65, F66, F67)
- [ ] 🟠 [Q17. Groceries: plan sync copy, emoji and aisle](Q17-groceries-plan-sync-copy.md) (F58, F57, F59, F22)

### Group E: Platform, auth and tooling
- [ ] 🟠 [Q20. Console errors: empty-id query, Reanimated warning](Q20-console-errors.md) (F06, F07)
- [ ] 🟡 [Q21. Dark mode: implement it or lock to light](Q21-dark-mode.md) (F77)
- [ ] 🟠 [Q22. Auth and session: sign-out screen, imports ledger, API URL](Q22-auth-session-and-ledger.md) (F78 + 2)

### Group F: Reported after the QA pass (product owner, 2026-10-17)
Findings F80–F86 come from device use, not the emulator pass. Two more reports map onto existing tasks: the share-screen progress row overlapping the text is **F34** ([Q07](Q07-import-progress-truthful.md) item 3), and the Today recommendation rule is an extension of **F21/F38/F54** ([Q06](Q06-meal-type-and-tonight-hero.md)): next planned meal for the coming part of the day, otherwise a recipe chosen from cooking history and imports, instead of "newest recipe".
- [ ] 🔴 [Q26. Share-to-import while a video step or cook mode is open leaves it stuck over the new recipe](Q26-share-open-recipe-stuck-layers.md) (F80)
- [ ] 🔴 [Q23. No alarm sound when a cooking timer finishes](Q23-timer-alarm-sound.md) (F81)
- [ ] 🟠 [Q24. A finished timer keeps showing on other screens](Q24-finished-timer-shown-elsewhere.md) (F82)
- [ ] 🟠 [Q25. Back during a shared import cancels the recipe](Q25-share-back-cancels-import.md) (F83)
- [ ] 🟠 [Q27. The same recipe is sometimes imported twice](Q27-duplicate-imports.md) (F85)
- [ ] 🟡 [Q28. The Add-recipe sheet keeps the previous link](Q28-add-sheet-stale-link.md) (F86)
- [ ] 🟡 [Q29. Call "Method" "Steps"](Q29-rename-method-to-steps.md) (F84)

### Group G: Settings, language and layout requests (product owner, 2026-10-17)
Findings F87–F99. "Help → Take the tour has no working icon" is already **F08/F63 in [Q14](Q14-icon-glyphs.md)** (name `tour`, still used in `profile.tsx`), so it has no new task.
- [ ] 🔴 [Q30. The app is not fully translated into the selected language](Q30-app-translation-coverage.md) (F87)
- [ ] 🟠 [Q31. The recipe language must apply to every AI response](Q31-recipe-language-in-ai-responses.md) (F88)
- [ ] 🟠 [Q33. Default servings must be used when a recipe is generated](Q33-default-servings-at-generation.md) (F90, extends Q18)
- [ ] 🟠 [Q34. Metric still shows tsp / tbsp / lb](Q34-metric-shows-spoon-and-pound-units.md) (F91, extends Q16)
- [ ] 🟠 [Q37. Choose a profile picture](Q37-profile-picture.md) (F94)
- [ ] 🟠 [Q39. Recipe detail: tab height and long descriptions](Q39-recipe-detail-tab-height-and-description.md) (F96, F97)
- [ ] 🟠 [Q40. A focused field in a sheet leaves a gap above the keyboard](Q40-sheet-keyboard-gap.md) (F98)
- [ ] 🟡 [Q32. App and recipe language as dropdowns](Q32-language-dropdowns.md) (F89)
- [ ] 🟡 [Q35. Remove dietary preferences](Q35-remove-dietary-preferences.md) (F92, resolves the diet half of Q18)
- [ ] 🟡 [Q36. Remove the empty-state cards from Plan](Q36-plan-remove-empty-state-cards.md) (F93, makes F10 moot)
- [ ] 🟡 [Q38. Profile button on every tab](Q38-profile-button-on-all-tabs.md) (F95)
- [ ] 🟡 [Q41. Notes sheet empty state layout](Q41-notes-empty-state-layout.md) (F99)

## Suggested order
1. **Q01, Q02**: they decide whether an imported recipe can be cooked at all.
2. **Q12**: five screens lose words. It is one root cause (probably a few lines).
3. **Q07, Q18**: progress that lies, and settings that do nothing. Then **Q14**: one font regeneration fixes 18 icons.
4. **Q17, Q08, Q03, Q06**: copy/behaviour mismatches users hit on day one.
5. The rest are polish.
