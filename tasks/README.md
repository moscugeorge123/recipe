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

### Group A: Import experience
- [A1. Import loading component](A1-import-loading-component.md)
- [A2. Background import and floating pill](A2-background-import-pill.md)
- [A3. Imports history screen](A3-imports-history-screen.md)
- [A4. Import error states and error toast](A4-import-error-states.md)
- [A5. Add-sheet changes](A5-add-sheet-changes.md)

### Group B: Recipe page layout
- [B1. Hero overlay chips](B1-hero-overlay-chips.md)
- [B2. Header block: tag, title, byline, source link](B2-header-block-byline.md)
- [B3. Notes row on the recipe page](B3-notes-row.md)
- [B4. Method steps: extra rows](B4-method-step-rows.md)
- [B5. Bottom bar and header buttons (check)](B5-bottom-bar-header-buttons.md)

### Group C: Cookbook and Today cards
- [C1. Time chip over the card photo](C1-card-time-chip.md)
- [C2. Byline under the title](C2-card-byline.md)

### Group D: Other new features
- [D1. Recipe notes (general and per step)](D1-recipe-notes.md)
- [D2. Step video clips ("Watch step")](D2-step-video-clips.md)
- [D3. Cook timer settings](D3-cook-timer-settings.md)
- [D4. Skeleton / loading state](D4-skeleton-loading-state.md)
- [D5. Add to meal plan from the recipe menu](D5-add-to-meal-plan-menu.md)
- [D6. Tablet layout (iPad)](D6-tablet-layout.md)

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
