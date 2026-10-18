# Q39. Recipe detail: tab height leaves empty scroll, and long descriptions

🟠 Medium · mobile · Findings **F96** (tab height), **F97** (description)

## Problem

1. **F96.** On a recipe, the Ingredients and Steps panels take the height of the **taller** of the two. Opening the shorter tab leaves a blank area you can still scroll through before the page ends.
2. **F97.** The description under the byline is shown in full, however long. It should show at most 3 lines and expand when there are more.

## Evidence

Reported by the product owner. Code: `tortie/screens/recipe-detail.tsx`.

## Root cause (verified in code)

1. **F96.** The two panels are laid out side by side in one row (`flexDirection: 'row'`, `width: width * 2`, `alignItems: 'flex-start'`) and a `translateX` slides between them (`track` style) with opacity cross-fades. Nothing sets the row's height to the active panel, so the row (and the scroll content) is as tall as the taller panel. (The sheet pager `TurnPager` lower in the same file does measure each page and animate the height; the detail tabs do not.)
2. **F97.** `r.desc` is rendered in a plain `<T>` with no `numberOfLines`.

## Fix

**F96**
1. Reuse the measuring approach of `TurnPager`: `onLayout` per panel stores its height; the clipping container's height animates to `heights[seg]` (`withTiming`, same 460 ms/EASE as the slide). While measuring, fall back to the current layout.
2. Make the inactive panel non-interactive and hidden from accessibility (`pointerEvents="none"`, `importantForAccessibility="no-hide-descendants"`).
3. Keep scroll position sensible when switching: if the page was scrolled past the shorter panel's end, scroll to the segmented control.
4. The panels change height when servings scale, notes expand, or images load, so keep the `onLayout` handlers live.

**F97**
1. Clamp to `numberOfLines={3}`; detect truncation with `onTextLayout` (`lines.length > 3`) or by rendering a hidden full-height copy once.
2. If truncated, show a "More" text button under it ("Less" when open). Animate the height change (the file has `collapse.tsx`).
3. Don't show the toggle for short descriptions. Keep the italic serif style.
4. Localised labels ([Q30](Q30-app-translation-coverage.md)).

## Acceptance criteria

- With a short Steps list and long Ingredients (and the reverse), the page ends right after the visible panel in both tabs; no blank scroll.
- A 6-line description shows 3 lines and "More"; tapping it expands, then "Less" collapses; a 2-line description shows no toggle.
- Switching tabs animates smoothly and the segmented control stays in view.

## Tests

- Jest: the height helper (picks the active panel's measured height).
- Manual: a recipe with 3 ingredients / 12 steps and one with 25 ingredients / 4 steps; a long description at font scale 130 %.
