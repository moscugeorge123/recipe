import {
  keyboardOverlayInset,
  keyboardVisibleBottom,
  revealFocusedField,
} from '@/lib/keyboard';

describe('keyboardVisibleBottom', () => {
  test('uses the window when the keyboard is hidden', () => {
    expect(keyboardVisibleBottom(844, 844, 0)).toBe(844);
  });

  test('does not add a second inset when Android already resized the window', () => {
    expect(keyboardVisibleBottom(500, 498, 344)).toBe(500);
  });

  test('uses the keyboard top when it overlays the window', () => {
    expect(keyboardVisibleBottom(844, 500, 344)).toBe(500);
  });
});

describe('keyboardOverlayInset', () => {
  test('is zero when the keyboard is hidden', () => {
    expect(keyboardOverlayInset(844, 844, 0, 844)).toBe(0);
  });

  test('is zero when the window already lost a keyboard-sized strip', () => {
    expect(keyboardOverlayInset(500, 500, 344, 844)).toBe(0);
  });

  test('docks the full keyboard when it overlays a full-height window', () => {
    expect(keyboardOverlayInset(844, 500, 344, 844)).toBe(344);
  });

  test('docks the full keyboard when frame math claims resize but window is still full', () => {
    expect(keyboardOverlayInset(844, 844, 344, 844)).toBe(344);
  });
});

describe('revealFocusedField', () => {
  test('does nothing when the field is already fully visible', () => {
    expect(
      revealFocusedField({
        fieldTop: 120,
        fieldBottom: 200,
        visibleTop: 0,
        visibleBottom: 500,
        scrollY: 40,
      }),
    ).toEqual({ scrollY: 40, extraBottom: 0 });
  });

  test('scrolls just enough to uncover a clipped bottom edge', () => {
    expect(
      revealFocusedField({
        fieldTop: 420,
        fieldBottom: 520,
        visibleTop: 0,
        visibleBottom: 500,
        scrollY: 80,
        margin: 16,
      }),
    ).toEqual({ scrollY: 116, extraBottom: 36 });
  });

  test('scrolls up when the field sits above the visible area', () => {
    expect(
      revealFocusedField({
        fieldTop: 8,
        fieldBottom: 72,
        visibleTop: 80,
        visibleBottom: 500,
        scrollY: 200,
        margin: 16,
      }),
    ).toEqual({ scrollY: 112, extraBottom: 0 });
  });

  test('never asks for a full-screen spacer when only a sliver is hidden', () => {
    const result = revealFocusedField({
      fieldTop: 760,
      fieldBottom: 840,
      visibleTop: 0,
      visibleBottom: 800,
      scrollY: 0,
      margin: 16,
    });
    expect(result.extraBottom).toBe(56);
    expect(result.extraBottom).toBeLessThan(800);
    expect(result.scrollY).toBe(56);
  });

  test('pins a taller field to the top of the visible area', () => {
    expect(
      revealFocusedField({
        fieldTop: 200,
        fieldBottom: 700,
        visibleTop: 0,
        visibleBottom: 400,
        scrollY: 0,
        margin: 16,
      }),
    ).toEqual({ scrollY: 184, extraBottom: 316 });
  });
});
