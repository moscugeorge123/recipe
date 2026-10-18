# Q26. Share-to-import while a video step (or cook mode) is open leaves it stuck over the new recipe

🔴 High · mobile · Finding **F80**

## Problem

1. The user has a step video open ("Watch step").
2. They switch to another app and share a recipe link into Tortie. It imports.
3. They tap **Open recipe**. The recipe opens, but the old video viewer is still on screen, frozen in place over it.

The same happens with cook mode and other open sheets: the recipe opens **underneath** them.

## Evidence

Reported on a device; no screenshot. The step video clips feature (`D2`) was merged after the first QA pass, so this path was never tested.

## Root cause (verified in code)

* `useNav.openShare()` and `closeShare()` (`tortie/nav-store.ts`) only touch the share fields. `openRecipe(id)` only sets `detailId/detailOpen`. None of them close the other layers.
* The layers stack by z-index (`tortie/shell.tsx`): detail 35 · sheets 40–43 · editor 45 · **cook 50** · **step clip 57** · camera 60 · share 65. The share screen sits above everything, so it opens fine. When it closes and `openRecipe` runs, `clipOn` is still `true`, so the viewer (57) is drawn over the detail (35). Cook mode (50) would hide it as well.
* `StepClipSheet` keeps its own player and playback state while `clipOn` is true, so it looks frozen: it is the old recipe's video, not the new one.

## Fix

1. Add `closeOverlays()` to the nav store. It closes the step clip viewer, notes, menus/sheets, editor, camera, add sheet and welcome, and **keeps the cook session** (cook mode closes through the same path as the back button, so `keep()` still runs).
2. Call it before the share screen opens a recipe (`openImported` in `share-preview.tsx`) and before `ShareIntentBridge` opens the share layer, so an incoming share starts from a clean stack.
3. Pause the player when the viewer closes by any route (add a cleanup effect keyed on `clipOn`).
4. Same rule for the Add sheet's `openImported` and the import pill's "Open": a recipe opened from an import should always be the top thing on screen.
5. Add the layers to `popTopLayer` in the same order as the z-order so back and `closeOverlays` agree (the list is hand-written in two places).

## Acceptance criteria

- Clip viewer open → share-import → Open recipe: the new recipe is on screen, no video viewer.
- Cook mode open → share-import → Open recipe: the recipe shows; the cook card on Today still resumes the session.
- Menu/notes/editor open → same.
- Back after that goes to the Cookbook, not to a leftover sheet.

## Tests

- Jest on the nav store: `closeOverlays()` clears every `*On`/`*Open` flag but leaves `active` in the cook store.
- Manual: the three scenarios above on Android, using the `adb shell am start -a android.intent.action.SEND …` command from the README.
