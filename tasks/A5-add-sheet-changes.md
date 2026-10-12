# A5. Add-sheet changes

Group A: Import experience

## Design source
- Spec: [DESIGN.md](DESIGN.md), Group A › A5. Add-sheet changes. Read it first. It is the design this task implements.
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
