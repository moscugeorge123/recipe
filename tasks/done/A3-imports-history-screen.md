# A3. Imports history screen (new)

Group A: Import experience

**Status: done.** `tortie/screens/imports.tsx`, opened from the Add sheet button or the pill. History is local-only (newest 30, persisted). Not done: scanned-page imports (no scan import exists yet) and share-preview imports do not appear here.

## Design source
- Spec: [DESIGN.md](../DESIGN.md), Group A › A3. Imports history screen (new). Read it first. It is the design this task implements.
- Prototype: `Tortie App v2.dc.html`, screen: "Imports". Search the file for `data-screen-label="..."`.

## Design (`data-screen-label="Imports"`, pushed from the Add sheet)
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

## Repo
- Nothing in `tortie/`.
- Backend: `ExtractionJob` model and `GET /recipes/extract/jobs/:id`. There is no "list my jobs" endpoint.

## Enrich later
- A list endpoint, or local-only history with a server cross-check.
- Retention and the clear-history rule.
- Scanned-page imports (no URL).
