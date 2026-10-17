/** Space between a keyboard-docked sheet and the keyboard (Q40). */
export const KEYBOARD_SHEET_GAP = 8;
/** Bottom padding kept while the keyboard covers the home indicator / gesture bar. */
export const KEYBOARD_SHEET_PAD = 4;

/**
 * Gap above the keyboard and bottom padding for a sheet. The resting padding
 * clears the home indicator, which the keyboard hides, so it shrinks while the
 * keyboard is up. Never negative; never grows the resting padding.
 */
export function sheetKeyboardLayout(
  keyboardHeight: number,
  restingPad: number,
): { gap: number; padBottom: number } {
  const resting = Math.max(0, restingPad);
  if (!(keyboardHeight > 0)) return { gap: 0, padBottom: resting };
  return {
    gap: KEYBOARD_SHEET_GAP,
    padBottom: Math.min(resting, KEYBOARD_SHEET_PAD),
  };
}
