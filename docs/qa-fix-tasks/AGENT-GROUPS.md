# Agent work groups

Tasks regrouped so **one agent owns one area of the app** and touches mostly its own files. Each agent should read its tasks' files in full, implement them in the listed order, run the tests the tasks name, and commit on its own branch (`fix/<group-id>`), so merges stay small.

Task IDs link to the files in this folder. Unlike the A–G groups in [README.md](README.md) (which follow the QA report), these follow **code ownership**.

## Wave 1: run in parallel (disjoint files)

### G1. API: extraction and normalization quality
Area: `apps/api/src/modules/{normalization,validation,recipes,content}`. No mobile code except where noted.
1. [Q01](Q01-ingredient-units-and-ranges.md) units and ranges
2. [Q02](Q02-step-order-and-title-split.md) step order, title/body split
3. [Q03](Q03-title-casing-and-byline.md) title casing, byline
4. [Q04](Q04-ingredient-fidelity-and-groups.md) ingredient fidelity, groups, servings
5. [Q05](Q05-site-access-and-failures.md) blocked sites, thumbnails
6. [Q10](Q10-letterboxed-thumbnails.md) YouTube thumbnails
7. [Q06](Q06-meal-type-and-tonight-hero.md) meal type. Do the API half only; the `today.tsx` hero half goes to G4 after it merges.

### G2. Import flow and share-from-another-app
Area: `features/share`, `features/extraction`, `tortie/data/import-engine.ts`, `tortie/shell.tsx`, `nav-store.ts`, `share-preview.tsx`, `add-recipe.tsx`, plus `apps/api/.../shared/utils/url.ts` and the extraction job service.
1. [Q26](Q26-share-open-recipe-stuck-layers.md) stuck layers (shell/nav-store)
2. [Q25](Q25-share-back-cancels-import.md) Back cancels import
3. [Q07](Q07-import-progress-truthful.md) truthful progress
4. [Q27](Q27-duplicate-imports.md) duplicate imports
5. [Q28](Q28-add-sheet-stale-link.md) stale link
6. [Q08](Q08-supported-sources-and-error-copy.md) sources and error copy
7. [Q09](Q09-toasts.md) toasts (also in `shell.tsx`, so same owner as Q26)

### G3. Cook mode and timers
Area: `tortie/screens/cook.tsx`, `cook-store.ts`, `timer-alarm.ts`, `timer-clock.ts`.
1. [Q23](Q23-timer-alarm-sound.md) alarm sound
2. [Q24](Q24-finished-timer-shown-elsewhere.md) finished timer shown on other screens

### G4. Main tabs: Today, Cookbook, Plan, Groceries
Area: `tortie/screens/{today,cookbook,plan}.tsx`, `tortie/data/{cookbook,groceries}.ts`, `ui/empty-state.tsx`, `ui/profile-button.tsx`, meal-plan API service.
1. [Q36](Q36-plan-remove-empty-state-cards.md) Plan empty cards
2. [Q17](Q17-groceries-plan-sync-copy.md) groceries/plan sync copy, emoji, aisle
3. [Q15](Q15-cookbook-state-and-copy.md) cookbook state and copy
4. [Q38](Q38-profile-button-on-all-tabs.md) profile button on every tab
5. [Q06](Q06-meal-type-and-tonight-hero.md) Today hero half (after G1 merges)
6. [Q20](Q20-console-errors.md) console errors (`today.tsx`, `use-recipe.ts`)

### G5. Recipe detail, editor and notes
Area: `tortie/screens/{recipe-detail,editor,recipe-notes}.tsx`, `step-clip.tsx`, `ui/collapse.tsx`.
1. [Q29](Q29-rename-method-to-steps.md) rename Method to Steps
2. [Q39](Q39-recipe-detail-tab-height-and-description.md) tab height, long descriptions
3. [Q41](Q41-notes-empty-state-layout.md) notes empty state (needs G4's `empty-state.tsx` change; rebase first)
4. [Q19](Q19-detail-editor-cook-polish.md) polish. Skip the cook-mode items (G3 owns `cook.tsx`) and F10 (moot after Q36).
5. [Q11](Q11-placeholder-text.md) placeholder text (only the files above; leave `today.tsx` and `share-preview.tsx` to G4/G2)

### G6. Units, servings and measurement display
Area: `features/recipes/units.ts`, `tortie/lib/fmt.ts`, `recipe-presentation.ts`, grocery pick/units code, `editor-draft.ts`, `features/extraction/api.ts`.
1. [Q16](Q16-units-and-scaling-in-method-text.md) units and scaling in step text, editor unit leak
2. [Q34](Q34-metric-shows-spoon-and-pound-units.md) metric shows tsp/tbsp/lb
3. [Q33](Q33-default-servings-at-generation.md) default servings at generation

### G7. Profile, settings and auth
Area: `tortie/screens/profile.tsx`, `prefs-store.ts`, `auth-store.ts`, `sign-in.tsx`, `import-store.ts`, auth listener, `app.json`/`app.config.ts`, jobs routes.
1. [Q35](Q35-remove-dietary-preferences.md) remove dietary preferences
2. [Q18](Q18-dead-settings.md) dead settings (the diet half is resolved by Q35)
3. [Q32](Q32-language-dropdowns.md) language dropdowns
4. [Q37](Q37-profile-picture.md) profile picture
5. [Q13](Q13-signin-success-screen.md) sign-in success screen
6. [Q22](Q22-auth-session-and-ledger.md) session, ledger, API URL
7. [Q21](Q21-dark-mode.md) dark mode (or lock to light)

### G8. Shared UI primitives
Area: `tortie/ui/{text,icon,sheet}.tsx`, `app/_layout.tsx` (fonts), `assets/fonts`.
1. [Q12](Q12-heading-last-word-clipped.md) clipped heading words (fix in `text.tsx`; do not edit screens)
2. [Q14](Q14-icon-glyphs.md) icon fonts
3. [Q40](Q40-sheet-keyboard-gap.md) sheet keyboard gap

## Wave 2: start after Wave 1 has merged

### G9. Language and translation
Runs last because it touches every screen's text and would conflict with everything above.
1. [Q31](Q31-recipe-language-in-ai-responses.md) recipe language in every AI response (API routes plus `features/extraction/api.ts`, `features/pantry/api.ts`)
2. [Q30](Q30-app-translation-coverage.md) full app translation coverage (`src/i18n`), including the strings added or renamed in Wave 1 (for example "Steps", the new Plan and error copy)

## Conflict hot spots

| File | Owner | Others must |
| --- | --- | --- |
| `tortie/shell.tsx`, `nav-store.ts` | G2 | request changes from G2 or rebase after it merges |
| `tortie/screens/today.tsx` | G4 | G2 and G5 leave it alone (Q11 and Q20 items there belong to G4) |
| `tortie/ui/empty-state.tsx` | G4 | G5 rebases before Q41 |
| `tortie/prefs-store.ts` | G7 | G6 reads prefs only; any new field goes through G7 |
| `tortie/lib/fmt.ts` | G6 | G4 (Q15, Q17 plural/unit helpers) adds new functions, never edits existing ones |
| `recipe-extraction-v1.ts` | G1 | G6 and G9 rebase after it merges |

## Dependency order in short
G8 and G1 first (everything else benefits), then G2–G7 in parallel, then G9.
