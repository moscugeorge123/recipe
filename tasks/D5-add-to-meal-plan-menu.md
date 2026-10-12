# D5. Add to meal plan from the recipe menu

Group D: Other new features

## Design source
- Spec: [DESIGN.md](DESIGN.md), Group D › D5. Add to meal plan from the recipe menu. Read it first. It is the design this task implements.
- Prototype: `Tortie App v2.dc.html`, screen: "Recipe menu" (meal-plan sub-view). Search the file for `data-screen-label="..."`.

## Design
- Recipe ⋯ menu: "Add to meal plan · Choose a day". The sub-view has week navigation and expandable day rows. Each row is summarised: "Nothing planned", "Day is full", or the free meals.
- A day expands to breakfast, lunch and dinner rows: open (+), current recipe (check), or occupied (other title, with a toast).

## Repo
- `github.md` lists it as synced in `recipe-detail.tsx`. Verify against the design.
