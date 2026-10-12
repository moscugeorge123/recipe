# Plan: New features from the Tortie redesign prototype (v2)

## Context
You handed over `Savory App redesign prototype.zip`. It holds the Tortie phone prototype (`Tortie App v2`), a tablet prototype, a behaviour spec and two handoff folders.

My first pass missed items because I diffed v2 against the `pre-sync` file, which already contained some of them. This version compares v2 against **the repo itself** (`apps/mobile/src/tortie`, `apps/api`). It also compares v2 against the baseline prototype in `design_handoff_tortie_app/`, which the README describes.

This is a feature inventory. It has no implementation steps. Each module is self-contained, so you can enrich it later.

**Legend:**
- **Design**: what the prototype shows.
- **Repo**: what exists today.
- **Enrich later**: open questions and gaps.

Design source is `Tortie App v2.dc.html` (phone). Search its screen labels, for example `data-screen-label="Imports"`.

## Already in the repo (excluded)
Each has a matching file. I did not compare their behaviour with the design in detail.
- Ingredient picker before adding to groceries: `screens/grocery-pick.tsx`
- Multi-item smart-add review ("Add all" / "Not now"): `screens/groceries.tsx`
- Plan multi-select and day swipe: `plan-select.tsx`, `plan-day-swipe.tsx`
- Cookbook multi-select with bulk actions: `cookbook-select.tsx`
- Share/import preview screen: `share-preview.tsx`
- Everything in the main handoff README: Today, Cookbook, Plan, Groceries/Pantry, Scan, Editor, Cook mode, Profile, Sign-in

---

# GROUP A: Import experience

### A1. New import loading component (live "recipe being built" card)
**Design** (Add a recipe sheet, importing state)
- **Header:** a 40 px conic "orb", a shimmering stage label, and a percentage.
- **Five stages, switched by progress:**
  - 0%: Reading the page
  - 18%: Grabbing the photo
  - 34%: Picking out ingredients
  - 66%: Writing the steps
  - 94%: Plating it up
- **Preview card:**
  - The photo area shows a terracotta **scan beam** (`tortieScan`) while progress is under 22%, with the source chip (platform logo and host).
  - Title ("Sicilian Caponata"), a meta line, ingredient **chips** that fill in, and step rows with their own progress.
  - A progress strip at the bottom.
- **Done state:** a pop-in tile with sparkles, an "Added to Cookbook" card, a source line and an **Open recipe** button.

**Repo**
- `tortie/ui/import-progress.tsx` has the older stage list ("Reading the page" … "Wrote N steps").
- `screens/add-recipe.tsx` holds the idle, importing and done states.
- `features/extraction/*` drives the job: `use-extraction-job.ts`, `stage-map.ts`.

**Enrich later**
- Which real extraction data feeds the chips and steps (partial results, or placeholders until the job finishes).
- Map the five stages to the real pipeline stages (acquire, media, transcribe, vision, OCR, extract, normalize, validate).
- The `tortieScan` animation needs a Reanimated port.

### A2. Background import and the floating "Importing…" pill
**Design**
- While importing, the sheet shows **"Keep browsing — it'll finish in the background"**.
- Closing the sheet keeps the job running. A floating pill appears over the app: "Importing a recipe", or "Importing 3 recipes", with a progress ring (average progress) and a chevron. Tapping it opens Imports (A3).
- The pill hides while a full-screen layer is open: sheet, imports, detail, profile, cook, editor, camera.
- When a background job finishes, a toast says "{title} added to Cookbook".
- A retry from history starts a **background** job, which runs slower.

**Repo**
- Nothing like it. The extraction job is tied to the open sheet.
- `features/extraction/hooks/use-extraction-job.ts` polls one job.
- `share-preview.tsx` has the share flow.

**Enrich later**
- A multi-job queue in a store, persisted across restarts.
- Job lifecycle: cancel, resume after the app is killed, push notification when done.
- Where the pill sits relative to the tab bar and the tablet layout.

### A3. Imports history screen (new)
**Design** (`data-screen-label="Imports"`, pushed from the Add sheet)
- **Entry point:** a `history` **"Imports"** button in the Add sheet header, with a badge showing the running count.
- **Header:** back, and a **Clear history** text button when there is history. Title "Imports", subtitle "Links you've sent to Tortie, newest first."
- **In progress section:**
  - A row per job: platform logo, host, stage label, percent, a cancel (×) button and a progress bar.
  - Empty: "Nothing importing right now" plus a **Paste a link** button.
- **History section:**
  - Done rows: thumbnail, title, source line, chevron. Tap opens the recipe.
  - Failed rows: error icon, message, source, Retry (with a countdown when rate-limited) and remove (×).
  - Empty: "Finished and failed imports will show up here."
- Source types: a brand logo, a website (globe icon), or a scanned page (camera icon).
- Toasts: "Import cancelled", "History cleared".

**Repo**
- Nothing in `tortie/`.
- Backend: `ExtractionJob` model and `GET /recipes/extract/jobs/:id`. There is no "list my jobs" endpoint.

**Enrich later**
- A list endpoint, or local-only history with a server cross-check.
- Retention and the clear-history rule.
- Scanned-page imports (no URL).

### A4. Import error states and error toast
**Design** (`data-screen-label="Import error"`)
- Five error groups, each with an icon, a message, a sub-line, and a primary and secondary action:
  - **Not a recipe** (`no_meals`): "That link doesn't look like a food recipe". Actions: Try another link, Write it yourself.
  - **Unsupported source** (`link_off`): "TikTok links aren't supported yet…". Actions: Try another link, Scan a page.
  - **Couldn't open** (`public_off`): "Couldn't open that link — check it and try again". Actions: Try again, Edit link.
  - **Rate limited** (`hourglass_top`, amber): "That source is busy…". Try again is locked with a **15 s countdown**. Actions: Try again in Ns, Edit link.
  - **Generic** (`sentiment_dissatisfied`): "Couldn't read a recipe from that link". Actions: Try again, Write it yourself.
- Backend error codes map to the groups: `NOT_A_RECIPE`, `UNSUPPORTED_SOURCE`, `INVALID_URL`, `CONTENT_ACQUISITION_FAILED`, `TOO_MANY_REQUESTS`, `PROVIDER_RATE_LIMITED`, and anything else maps to the generic group.
- **Error toast variant:** red `error` icon, shown for 3.8 s instead of 2.4 s.
- The same error rows appear in Imports history.

**Repo**
- `lib/user-error.ts` already maps API error codes to user copy.
- `tortie/ui/toast.tsx` has no error variant.
- No error screen inside the Add sheet.

**Enrich later**
- Reuse `user-error.ts` copy, or adopt the design's copy.
- Retry-after from the server, instead of a fixed 15 s.
- TikTok and Facebook providers are still stubs on the API.

### A5. Add-sheet changes
**Design**
- The header gains the Imports button (A3).
- The link field shows platform detection, and a website gets a globe icon.
- **Clipboard suggestion row:** "Detected {platform} link" with an Import button.
- The CTA is "Import from Instagram" and similar.
- The scan flow imports as a "Scanned page" source.

**Repo**
- `screens/add-recipe.tsx` has clipboard detection and platform logos.
- Check the Imports button, website detection and CTA text against the design.

---

# GROUP B: Recipe page layout (new)

### B1. Hero overlay chips replace the 3-stat tiles
**Design**
- The three tiles (Total time / Level / Steps) below the title are **removed**.
- Frosted pills now sit on the hero photo, bottom-left, 30 px tall, wrapping:
  - `schedule` + time
  - `skillet` + level
  - `format_list_numbered` + "n steps"
  - `local_fire_department` + kcal per portion
- Pill style: `rgba(25,28,25,.58)`, blur 8, text #f8faf5, 13/700.

**Repo**
- `screens/recipe-detail.tsx` (around lines 225-235) has the old three tiles ("Total time", "Level", icon `format_list_numbered`).
- The nutrition block exists separately.

**Enrich later**
- Where kcal, kcal per 100 g and portion weight go now (README says a nutrition block).
- Behaviour when kcal is missing.
- Hero when there is no photo.

### B2. Header block: tag, title, byline and source link
**Design**
- The tag is now a small uppercase green label, not a filled pill.
- Under the title: **"by {author}"** with the author in bold. For imported recipes it adds `·` and a link with the source host ("instagram.com ↗", `open_in_new`) that opens the original. Recipes the user wrote say "by You".
- The description follows.

**Repo**
- No byline.
- The README mentions an "Original source" action that is still a stub.
- `features/recipes` has `originalUrl`, and `recipe-detail.tsx` copies it to the clipboard (about line 852).

**Enrich later**
- Where the author name comes from (creator handle from the unfurler, or a field on `RecipeSource`).
- The fallback when the author is unknown.

### B3. Notes row on the recipe page
See F1 for the whole notes feature. The page change is a row under the description. It has an icon tile, the title "Notes" with a count badge, a one-line preview, and a trailing chevron or `add`.

### B4. Method steps: extra rows
**Design**
- A step can show a duration chip, a **Watch step** clip chip (F2), and a collapsible notes block (F1).
- The first step number keeps the #fe8357 treatment.

**Repo**
- Plain numbered steps with a timer chip.

### B5. Bottom bar and header buttons (check)
**Design**
- A floating bar has the servings stepper (− value "servings" +) and **Start cooking**.
- Top buttons: back, then edit and more (…).

**Repo**
- `recipe-detail.tsx` has the servings stepper next to "Start cooking"/"Resume cooking" (about lines 557-593).
- Verify the layout against the design. It may already match.

---

# GROUP C: Cookbook and Today cards

### C1. Time chip over the card photo
**Design**
- Cookbook grid cards get a **time chip on the photo**, bottom-left, 8 px inset.
- It is 24 px tall, with a `schedule` icon and the duration.
- Style: `rgba(25,28,25,.62)`, blur 6, 11/700, text #f8faf5.
- It coexists with the multi-select check, which sits top-right.

**Repo**
- `screens/cookbook.tsx` shows only the text meta under the card (about lines 867 and 916). No time chip.

**Enrich later**
- List view: the design shows no chip on list rows, only the byline and meta text.
- What to show when the time is missing.

### C2. Byline under the title
**Design**
- Under the card title: "by Pia Castellano" (or "by you"), then the meta line.
- Applies to Cookbook grid and list, and to the Today "Cook again" cards (byline + time label).

**Repo**
- Not present.

---

# GROUP D: Other new features

### D1. Recipe notes (general and per step) — F1
**Design**
- The Notes row (B3) opens a **Recipe notes** sheet:
  - note list with relative date ("Today", "Yesterday", "3 days ago") and a "Step n" badge;
  - a composer with chips (General, Step 1…n);
  - Enter to send, Shift+Enter for a new line, a send/check button, and an "Editing note" state with cancel;
  - edit and delete per note.
- Steps show a note block, clamped to 2 lines, with "Show all n" / "Show less" and "Add".
- Cook mode shows the same notes on the intro (general) and on each step.

**Repo**
- API exists: `RecipeNote` model, and `GET`/`POST /recipes/:id/notes`, `PATCH`/`DELETE .../notes/:noteId`.
- Mobile data layer exists: `features/recipes/hooks/use-recipe-notes.ts`, `stores/kitchen-store.ts`.
- **No UI in `tortie/screens`.**

**Enrich later**
- `RecipeNote` has no step link, so it needs `stepIndex?`.
- Cook-session notes (`cookSessionId`) versus recipe-level notes.

### D2. Step video clips ("Watch step") — F2
**Design**
- Recipes imported from a video get a timestamp per step.
- Method rows and cook step pages show a **Watch step** chip with the clip range ("0:29–0:51").
- It opens a **Step clip sheet**:
  - a player, vertical 192×340 for reels or wide 100%×200;
  - a segmented bar, one segment per step;
  - play/pause, replay, previous and next step;
  - a "left" countdown and a "Step clip done" end state;
  - "Open on {platform}", or "Open in YouTube at 1:23".
- The prototype simulates playback.

**Repo**
- None.
- The API has transcript and video repositories that could supply timestamps.

**Enrich later**
- A per-step start time and the source video duration in the data model.
- Player strategy (embed, deep link, or a downloaded clip).
- The tablet prototype omits this feature.

### D3. Cook timer settings — F3
**Design**
- The step timer card gets a config toggle that opens a panel:
  - a duration stepper (1 below 10, 5 from 10 up, clamped 1–600 min);
  - presets (Recipe default, 1, 3, 5, 10, 15, 20, 30);
  - an **Auto-start** switch, "Start when you reach this step";
  - an "Apply: Set timer to X" button.
- **−1 min** and **+5 min** buttons are added next to +1 min.

**Repo**
- `screens/cook.tsx` has only +1 min (about lines 723, 1336). `timer-clock.ts` and `timer-alarm.ts` exist.

**Enrich later**
- Persistence per recipe or step, and the relation to timer alarms.

### D4. Skeleton / loading state — F5
**Design**
- Every text block, image and tile can show a shimmering skeleton (`tlSkWave`, `tlSkBreath`), driven by a `loadingState` prop. It covers all tabs and sheets.

**Repo**
- Only the shimmer-text keyframe in `tortie/ui/keyframes.tsx`.
- No reusable skeleton.

### D5. Add to meal plan from the recipe menu
**Design**
- Recipe ⋯ menu: "Add to meal plan · Choose a day". The sub-view has week navigation and expandable day rows. Each row is summarised: "Nothing planned", "Day is full", or the free meals.
- A day expands to breakfast, lunch and dinner rows: open (+), current recipe (check), or occupied (other title, with a toast).

**Repo**
- `github.md` lists it as synced in `recipe-detail.tsx`. Verify against the design.

### D6. Tablet layout (iPad) — F6
**Design** (`Tortie Tablet v2`)
- **Portrait 834×1194:** an icon rail replaces the tab bar. The recipe detail covers the content.
- **Landscape 1194×834:**
  - a labelled **sidebar**;
  - **split view** (list left, detail right) for recipes and profile;
  - a **Cook timers side panel**, 372 px wide, in cook mode.
- Includes the new phone features except step clips. It also has Imports and import error.

**Repo**
- Nothing. The shell is phone-only (`tortie/frame.ts`, `shell.tsx`).

**Enrich later**
- Breakpoints, responsive sheets, nav-store changes for split-view selection.

---

## Suggested enrichment order
1. **Group C** (time chip, byline): small, visible, quick.
2. **Group B** (recipe page layout): visible and self-contained.
3. **Group A** (import): the biggest user-facing change. Start with A1, then A4, then A2 and A3.
4. **D3, D1, D4**: timer settings, notes, skeletons.
5. **D2** (clips): needs a data-model decision first.
6. **D6** (tablet): the largest.
7. Verify D5, B5 and the excluded items.

## Verification (when implementing a module)
- Open `Tortie App v2.dc.html` in a browser (with `support.js` alongside) and compare screen by screen.
- Screen labels map to modules: "Imports", "Import error", "Recipe", "Recipe notes", "Step clip", "Cookbook", "Sidebar", "Cook timers".
- Unit tests go in the repo's `__tests__` folders (jest), for pure data logic such as job state, error-group mapping, and note ordering.
- Manual checks on iOS and Android simulators, plus an iPad simulator for D6.
