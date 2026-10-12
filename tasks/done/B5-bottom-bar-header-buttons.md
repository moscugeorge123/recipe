# B5. Bottom bar and header buttons (check)

Group B: Recipe page layout

## Design source
- Spec: [DESIGN.md](../DESIGN.md), Group B › B5. Bottom bar and header buttons (check). Read it first. It is the design this task implements.
- Prototype: `Tortie App v2.dc.html`, screen: "Recipe". Search the file for `data-screen-label="..."`.

## Design
- A floating bar has the servings stepper (− value "servings" +) and **Start cooking**.
- Top buttons: back, then edit and more (…).

## Repo
- `recipe-detail.tsx` has the servings stepper next to "Start cooking"/"Resume cooking" (about lines 557-593).
- Verify the layout against the design. It may already match.

## Status
Checked against `Tortie App v2.dc.html` (screen "Recipe"). `screens/recipe-detail.tsx` already matches, so no code changed:
- Header buttons: back (left 16), edit (right 66, 21px glyph) and more (right 16), each 42px and frosted, at `pushTop` (status + 4, which is 54 with the design's 50px status bar). They are in the same order as the prototype.
- Bottom bar: 14/20/barPad padding, a gradient fade from transparent to the background at 36%, and a 10px gap.
- Servings pill: white, 1px border, 56px high, with 44×48 − and + buttons and a 19px serif value over a 10px "servings" label. The count is clamped by `useServings`.
- Start cooking: terracotta, 56px high, filled play_arrow glyph, and it reads "Resume cooking" when a cook is in progress.
