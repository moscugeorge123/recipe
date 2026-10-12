# C2. Byline under the title

Group C: Cookbook and Today cards

## Design source
- Spec: [DESIGN.md](../DESIGN.md), Group C › C2. Byline under the title. Read it first. It is the design this task implements.
- Prototype: `Tortie App v2.dc.html`, screen: "Cookbook" and "Today" (Cook again cards). Search the file for `data-screen-label="..."`.

## Design
- Under the card title: "by Pia Castellano" (or "by you"), then the meta line.
- Applies to Cookbook grid and list, and to the Today "Cook again" cards (byline + time label).

## Repo
- Not present.

## Enrich later
- Shares the author-source question with [B2](B2-header-block-byline.md).

## Status
Done. `TRecipe.byline` is "by {creator}" for imported recipes and "by you" otherwise (`bylineOf` in `data/recipes.ts`, the same rule as the recipe page byline in B2). `Byline` (green 12/600, one line) is under the title on Cookbook grid cards, Cookbook list rows and Today "Cook again" cards, which now show the time chip instead of a separate time label. Tests are in `data/__tests__/recipe-byline-test.ts`.
