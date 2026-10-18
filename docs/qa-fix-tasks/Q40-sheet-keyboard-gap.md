# Q40. A focused field in a sheet leaves a gap above the keyboard

🟠 Medium · mobile · Finding **F98**

## Problem

When a text field in a bottom sheet is focused, the sheet rises above the keyboard but leaves a visible empty band between its content and the keyboard.

## Evidence

Reported by the product owner (any sheet with `avoidKeyboard`: Add recipe, notes, new collection, edit grocery/pantry). No screenshot.

## Root cause (verified in code)

`tortie/ui/sheet.tsx`, with `avoidKeyboard`:

* The sheet is lifted by `useKeyboardLift(KEYBOARD_BOTTOM_GAP)`: `bottom = keyboardHeight + 16`.
* The sheet also keeps its own bottom padding, which callers set for the **resting** state: `paddingBottom: Math.max(36, f.sheetBottom)` (Add sheet) and the default `34`; `f.sheetBottom` is the home-indicator inset.

With the keyboard open the content therefore sits `16 + 34…36 + inset` ≈ 50–70 px above the keyboard. The bottom padding exists to clear the home indicator or gesture bar, which the keyboard now covers, so it should disappear (or shrink) while the keyboard is up. `scrollMax` also subtracts `padBottom`, so the visible area is smaller than it needs to be.

## Fix

1. In `Sheet`, when `avoidKeyboard && kb.h > 0`, animate `paddingBottom` from the resting value to a small constant (e.g. 12) with the same duration and easing as the lift (`kb.ms`, `EASE`), and use that value in `scrollMax`. Restore it when the keyboard hides.
2. Reduce `KEYBOARD_BOTTOM_GAP` from 16 to 8 once the padding is gone, so the sheet sits just above the keyboard; the focused field is kept in view by `KeyboardScroll`.
3. Keep the sheet's `footer` (CTA) docked at the bottom with the same small gap.
4. Check `reportAppFrame` / `keyboardOverlayInset` on devices where the app frame ends above the screen bottom (gesture navigation, edge-to-edge): the gap must not turn negative.

## Acceptance criteria

- Focus a field in each `avoidKeyboard` sheet: the sheet's bottom edge or footer is at most ~8–12 px above the keyboard, with no empty band.
- Dismissing the keyboard returns to the resting padding without a jump.
- With three-button navigation, gesture navigation and a notch device, the CTA is never covered.

## Tests

- Jest: pure helper for the padding/gap given `kb.h`, inset and resting padding.
- Manual: the five sheets above on Pixel 6, a small phone and iOS if available.
