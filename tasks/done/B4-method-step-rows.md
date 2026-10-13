# B4. Method steps: extra rows

Group B: Recipe page layout

## Design source
- Spec: [DESIGN.md](../DESIGN.md), Group B › B4. Method steps: extra rows. Read it first. It is the design this task implements.
- Prototype: `Tortie App v2.dc.html`, screen: "Recipe" (Method section). Search the file for `data-screen-label="..."`.

## Design
- A step can show a duration chip, a **Watch step** clip chip ([D2](../D2-step-video-clips.md)), and a collapsible notes block ([D1](D1-recipe-notes.md)).
- The first step number keeps the #fe8357 treatment.

## Repo
- Plain numbered steps with a timer chip.
- The collapsible notes block is done (see [D1](D1-recipe-notes.md)). The **Watch step** chip waits on D2.

## Status
The duration chip, the first-step #fe8357 number and the collapsible notes block are in `screens/recipe-detail.tsx`. Only the **Watch step** chip is open, and it waits on [D2](../D2-step-video-clips.md), so that part is tracked there.
