# A5. Add-sheet changes

Group A: Import experience

**Status: done, except the scan import.** The Imports button (A3), globe icon for websites, clipboard row and platform detection were already in place. The CTA is now a visible full-width button ("Import from Instagram", "Import recipe" when no platform is detected) in place of the arrow-only button. The scan flow still shows "Reading recipes from photos isn't available yet": the API has no image upload endpoint, so a "Scanned page" job can't be created. The import list and history already support that source kind (`kind: 'scan'`).

## Design source
- Spec: [DESIGN.md](../DESIGN.md), Group A › A5. Add-sheet changes. Read it first. It is the design this task implements.
- Prototype: `Tortie App v2.dc.html`, screen: Add a recipe sheet (idle state). Search the file for `data-screen-label="..."`.

## Design
- The header gains the Imports button ([A3](A3-imports-history-screen.md)).
- The link field shows platform detection, and a website gets a globe icon.
- **Clipboard suggestion row:** "Detected {platform} link" with an Import button.
- The CTA is "Import from Instagram" and similar.
- The scan flow imports as a "Scanned page" source.

## Repo
- `screens/add-recipe.tsx` has clipboard detection and platform logos.
- Check the Imports button, website detection and CTA text against the design.
