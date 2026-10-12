# B5. Bottom bar and header buttons (check)

Group B: Recipe page layout

## Design source
- Spec: [DESIGN.md](DESIGN.md), Group B › B5. Bottom bar and header buttons (check). Read it first. It is the design this task implements.
- Prototype: `Tortie App v2.dc.html`, screen: "Recipe". Search the file for `data-screen-label="..."`.

## Design
- A floating bar has the servings stepper (− value "servings" +) and **Start cooking**.
- Top buttons: back, then edit and more (…).

## Repo
- `recipe-detail.tsx` has the servings stepper next to "Start cooking"/"Resume cooking" (about lines 557-593).
- Verify the layout against the design. It may already match.
