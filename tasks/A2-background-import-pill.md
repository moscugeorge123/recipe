# A2. Background import and the floating "Importing…" pill

Group A: Import experience

## Design source
- Spec: [DESIGN.md](DESIGN.md), Group A › A2. Background import and the floating "Importing…" pill. Read it first. It is the design this task implements.
- Prototype: `Tortie App v2.dc.html`, screen: Add a recipe sheet (importing state, "Keep browsing"); the floating pill over the app shell. Search the file for `data-screen-label="..."`.

## Design
- While importing, the sheet shows **"Keep browsing — it'll finish in the background"**.
- Closing the sheet keeps the job running. A floating pill appears over the app: "Importing a recipe", or "Importing 3 recipes", with a progress ring (average progress) and a chevron. Tapping it opens Imports ([A3](A3-imports-history-screen.md)).
- The pill hides while a full-screen layer is open: sheet, imports, detail, profile, cook, editor, camera.
- When a background job finishes, a toast says "{title} added to Cookbook".
- A retry from history starts a **background** job, which runs slower.

## Repo
- Nothing like it. The extraction job is tied to the open sheet.
- `features/extraction/hooks/use-extraction-job.ts` polls one job.
- `share-preview.tsx` has the share flow.

## Enrich later
- A multi-job queue in a store, persisted across restarts.
- Job lifecycle: cancel, resume after the app is killed, push notification when done.
- Where the pill sits relative to the tab bar and the tablet layout.
