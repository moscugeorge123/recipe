# Q25. Back during a shared import cancels the recipe

🟠 Medium · mobile · Finding **F83**

## Problem

The user shares a link into Tortie, taps **Import**, then presses back (the on-screen arrow or the Android back button). The import is **cancelled** and the recipe is never saved. The Add sheet behaves the other way: its copy says "Keep browsing — it'll finish in the background", and a pill and the Imports screen track it. Leaving the share screen should do the same.

## Evidence

Reported on a device; no screenshot.

## Root cause (verified in code)

* `tortie/screens/share-preview.tsx`: `useEffect(() => { if (wasOpen.current && !open) cancelImport(); … })`. **Any** close of the share layer cancels a running import. The back arrow is even labelled "Cancel import" while importing.
* `popTopLayer()` in `tortie/shell.tsx` handles the Android back button by calling `closeShare()` first, which triggers the effect above.
* `useSharedImport` (`features/share/use-shared-import.ts`) keeps its own job state in React state, local to `SharePreview`. It is not in the `useImports` ledger, so the pill, the Imports screen and the badge never see it, and nothing could continue it once the screen closes. `cancel()` also calls `cancelExtraction()` on the server job.

## Fix

1. Replace `useSharedImport`'s private timers/state with the shared engine (`startImport` / `useImports`), as [Q07](Q07-import-progress-truthful.md) item 3 already asks. A share import then shows up in the pill and in Imports like any other.
2. Back arrow and Android back **close the share screen and leave the import running**. Only the explicit **Cancel** button cancels (`cancelImport(id)`).
3. Rename the back arrow's accessibility label to "Close" in every state.
4. When a background import from a share finishes, show the existing "Saved to Cookbook" toast with an **Open** action (the engine/pill already has this for sheet imports).
5. If the same link is shared again while its import is still running, reopen the share screen on the running import instead of starting another (see [Q27](Q27-duplicate-imports.md)).

## Acceptance criteria

- Import → back arrow: the share screen closes, the pill shows progress, and the recipe lands in the Cookbook.
- Import → Android back: same.
- Import → **Cancel**: the import stops, as today.
- Killing the app mid-import is out of scope here (server job carries on; Imports history is [Q22](Q22-auth-session-and-ledger.md)).

## Tests

- Jest: share screen close with a running import does not call `cancelExtraction`; Cancel does.
- Manual: share a slow YouTube link, press back at 30 %, watch the pill finish; same with the hardware back button.
