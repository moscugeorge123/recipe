# Q36. Remove the empty-state cards from Plan

🟡 Low · mobile · Finding **F93** (makes F10 in [Q19](Q19-detail-editor-cook-polish.md) moot)

## Problem

The Plan tab shows a large empty-state card above the day's slots. The product owner wants it removed.

## Evidence

`018-plan-empty.png`, `069-plan-day.png`. Code: `tortie/screens/plan.tsx`.

## Where the cards come from

* `NothingToPlan` (no recipes saved): "An open week / Nothing to plan with yet", with **Add a recipe** and **Take the tour**.
* `BlankWeek` (recipes exist, nothing planned this week): "A blank week" with **Plan tonight's dinner**.
* Both use `EmptyState` (`ui/empty-state.tsx`, art plus text).

"The empty state card" is singular in the request. This task assumes both go; if only `BlankWeek` should go, keep `NothingToPlan` because with no recipes every slot leads to an empty Cookbook.

## Fix

1. Delete the `<NothingToPlan>` and `<BlankWeek>` branches in `PlanScreen` and the two components. Always render `DayContent`.
2. With no recipes, tapping a slot should not open an empty picker: show the toast "Save a recipe first" and open the Add sheet (`openAdd`) so the dead end has an exit. Keep this to one line so no card is needed.
3. The "past week" copy ("Past weeks show what you planned") disappears with `BlankWeek`; if empty past weeks look broken, show a muted one-line caption instead of a card.
4. Remove now-unused icons from [Q14](Q14-icon-glyphs.md)'s missing list (`edit_calendar`, `dark_mode` for this screen) and the `EmptyState` props used only here.
5. [Q19](Q19-detail-editor-cook-polish.md) F10 (cropped "R" on the card art) needs no further work; mark it as superseded.

## Acceptance criteria

- Plan never shows an `EmptyState` card, with or without recipes, in any week.
- Slots stay tappable and either pick a recipe or explain why not.
- The first-run flow still reaches the tour from Profile → Help.

## Tests

- Jest: Plan renders the day slots for zero recipes and for a blank week.
