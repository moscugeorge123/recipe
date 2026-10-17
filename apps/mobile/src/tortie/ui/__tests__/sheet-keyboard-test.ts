import {
  KEYBOARD_SHEET_GAP,
  KEYBOARD_SHEET_PAD,
  sheetKeyboardLayout,
} from '@/tortie/ui/sheet-keyboard';

describe('sheetKeyboardLayout', () => {
  it('keeps resting padding and no lift gap without a keyboard', () => {
    expect(sheetKeyboardLayout(0, 36)).toEqual({ gap: 0, padBottom: 36 });
  });
  it('shrinks the padding and uses the small gap with the keyboard up', () => {
    expect(sheetKeyboardLayout(300, 36)).toEqual({
      gap: KEYBOARD_SHEET_GAP,
      padBottom: KEYBOARD_SHEET_PAD,
    });
  });
  it('never grows a smaller resting padding and never goes negative', () => {
    expect(sheetKeyboardLayout(300, 2).padBottom).toBe(2);
    expect(sheetKeyboardLayout(300, -5).padBottom).toBe(0);
    expect(sheetKeyboardLayout(-1, 20).gap).toBe(0);
  });
  it('keeps total space above the keyboard within 12px', () => {
    const l = sheetKeyboardLayout(300, 36);
    expect(l.gap + l.padBottom).toBeLessThanOrEqual(12);
  });
});
