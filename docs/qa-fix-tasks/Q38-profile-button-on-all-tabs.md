# Q38. Show the profile button on every tab of the bottom bar

🟡 Low · mobile · Finding **F95**

## Problem

The round avatar/profile button exists only in the Today header. On Cookbook, Plan and Groceries there is no way to reach Profile; the user has to go back to Today first.

## Evidence

Code: the button is inline in `TodayHeader` (`tortie/screens/today.tsx`, `<Press … accessibilityLabel="Profile">`). `CookbookHeader`, `PlanHeader` and `GrocHeader` have only a title and subtitle.

## Fix

1. Extract `ProfileButton` from `TodayHeader` into `tortie/ui/profile-button.tsx` (initials, signed-out person icon, photo from [Q37](Q37-profile-picture.md)). It takes a `size` or an animated style so it can follow the header's compact/expanded animation (`logo` style: 40 → 30 px).
2. Put it at the right end of all four tab headers: same position, same size, and the same shrink when the header goes compact. Titles must not run under it (`flex: 1`, `numberOfLines={1}`).
3. Check collisions: Cookbook's search/filter row sits under the header, Groceries has Groceries/Pantry toggles, and the dev-client gear floats at the top-right in debug builds only.
4. Hide it during selection modes (Cookbook/Plan multi-select) if the bars use the same area; the existing selection bars already take over.
5. `accessibilityLabel` from `t()` ([Q30](Q30-app-translation-coverage.md)).
6. Tapping it calls `openProfile` as today; back returns to the same tab.

## Acceptance criteria

- Avatar button visible and working on Today, Cookbook, Plan and Groceries, at 360 dp and Pixel 6 widths, expanded and compact header.
- Opening Profile and going back lands on the tab the user was on.
- No title truncation regressions on the other tabs (long Romanian titles).

## Tests

- Jest: the four headers render the button; press calls `openProfile`.
- Manual: scroll each tab so the header compacts.
