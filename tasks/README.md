# Tasks: New features from the Tortie redesign prototype (v2)

Source: `Savory App redesign prototype.zip` (Tortie phone prototype `Tortie App v2`, a tablet prototype, a behaviour spec and two handoff folders).

This is a feature inventory, with no implementation steps. Each task file is self-contained, so you can enrich it later. The inventory compares v2 against **the repo itself** (`apps/mobile/src/tortie`, `apps/api`) and against the baseline prototype in `design_handoff_tortie_app/`.

Each task file has three parts:
- **Design**: what the prototype shows.
- **Repo**: what exists today.
- **Enrich later**: open questions and gaps.

Design source is `Tortie App v2.dc.html` (phone). Search its screen labels, for example `data-screen-label="Imports"`.

**Design source:** [DESIGN.md](DESIGN.md) is the full design plan these tasks were split from (copied from `C:\Users\moscu\.claude\plans\check-the-new-features-imperative-forest.md`). Every task has a "Design source" section linking to its part of it and naming the prototype screen to compare against.

## Index

Finished tasks (checked `[x]`) live in [done/](done/).

### Group A: Import experience
- [x] [A1. Import loading component](done/A1-import-loading-component.md)
- [x] [A2. Background import and floating pill](done/A2-background-import-pill.md)
- [x] [A3. Imports history screen](done/A3-imports-history-screen.md)
- [x] [A4. Import error states and error toast](done/A4-import-error-states.md)
- [x] [A5. Add-sheet changes](done/A5-add-sheet-changes.md)

### Group B: Recipe page layout
- [x] [B1. Hero overlay chips](done/B1-hero-overlay-chips.md)
- [x] [B2. Header block: tag, title, byline, source link](done/B2-header-block-byline.md)
- [x] [B3. Notes row on the recipe page](done/B3-notes-row.md)
- [x] [B4. Method steps: extra rows](done/B4-method-step-rows.md)
- [x] [B5. Bottom bar and header buttons (check)](done/B5-bottom-bar-header-buttons.md)

### Group C: Cookbook and Today cards
- [x] [C1. Time chip over the card photo](done/C1-card-time-chip.md)
- [x] [C2. Byline under the title](done/C2-card-byline.md)

### Group D: Other new features
- [x] [D1. Recipe notes (general and per step)](done/D1-recipe-notes.md)
- [x] [D2. Step video clips ("Watch step")](done/D2-step-video-clips.md)
- [x] [D3. Cook timer settings](done/D3-cook-timer-settings.md)
- [D4. Skeleton / loading state](D4-skeleton-loading-state.md)
- [D5. Add to meal plan from the recipe menu](D5-add-to-meal-plan-menu.md)
- [D6. Tablet layout (iPad)](D6-tablet-layout.md)

### Group E: Dashboard ledger
- [x] [E1. Count ingredient generation and recipe edits in dashboard spend](done/E1-dashboard-ingredient-and-edit-costs.md)

## Already in the repo (excluded)
Each has a matching file. Their behaviour was not compared with the design in detail.
- Ingredient picker before adding to groceries: `screens/grocery-pick.tsx`
- Multi-item smart-add review ("Add all" / "Not now"): `screens/groceries.tsx`
- Plan multi-select and day swipe: `plan-select.tsx`, `plan-day-swipe.tsx`
- Cookbook multi-select with bulk actions: `cookbook-select.tsx`
- Share/import preview screen: `share-preview.tsx`
- Everything in the main handoff README: Today, Cookbook, Plan, Groceries/Pantry, Scan, Editor, Cook mode, Profile, Sign-in

## Suggested enrichment order
1. **Group C** (time chip, byline): small, visible, quick.
2. **Group B** (recipe page layout): visible and self-contained.
3. **Group A** (import): the biggest user-facing change. Start with A1, then A4, then A2 and A3.
4. **D3, D1, D4**: timer settings, notes, skeletons.
5. **D2** (clips): needs a data-model decision first.
6. **D6** (tablet): the largest.
7. Verify D5, B5 and the excluded items.

## Verification (when implementing a task)
- Open `Tortie App v2.dc.html` in a browser (with `support.js` alongside) and compare screen by screen.
- Screen labels map to tasks: "Imports", "Import error", "Recipe", "Recipe notes", "Step clip", "Cookbook", "Sidebar", "Cook timers".
- Unit tests go in the repo's `__tests__` folders (jest), for pure data logic such as job state, error-group mapping, and note ordering.
- Manual checks on iOS and Android simulators, plus an iPad simulator for D6.
