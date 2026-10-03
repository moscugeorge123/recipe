import {
  enterCard,
  enterChip,
  enterContent,
  enterMosaic,
  enterPantryMorph,
  enterSection,
  enterStep,
  enterTimeline,
  enterToast,
  exitChip,
  exitToast,
  layoutReorder,
  staggerDelay,
} from '@/lib/motion';

describe('motion helpers', () => {
  test('caps stagger so entrance never delays taps or recovery', () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(2, 40, 240)).toBe(80);
    expect(staggerDelay(20, 40, 240)).toBe(240);
  });

  test('reduced motion removes nonessential entering and layout', () => {
    expect(enterSection(true)).toBeUndefined();
    expect(enterCard(true, 3)).toBeUndefined();
    expect(enterChip(true)).toBeUndefined();
    expect(exitChip(true)).toBeUndefined();
    expect(enterTimeline(true, 1)).toBeUndefined();
    expect(enterMosaic(true, 2)).toBeUndefined();
    expect(enterPantryMorph(true, 4)).toBeUndefined();
    expect(enterContent(true)).toBeUndefined();
    expect(enterToast(true)).toBeUndefined();
    expect(exitToast(true)).toBeUndefined();
    expect(enterStep(true)).toBeUndefined();
    expect(layoutReorder(true)).toBeUndefined();
  });

  test('full motion returns layout animation builders', () => {
    expect(enterSection(false)).toBeDefined();
    expect(enterCard(false, 1)).toBeDefined();
    expect(enterChip(false)).toBeDefined();
    expect(exitChip(false)).toBeDefined();
    expect(enterTimeline(false, 0)).toBeDefined();
    expect(enterMosaic(false, 0)).toBeDefined();
    expect(enterPantryMorph(false, 0)).toBeDefined();
    expect(enterContent(false)).toBeDefined();
    expect(enterToast(false)).toBeDefined();
    expect(exitToast(false)).toBeDefined();
    expect(enterStep(false)).toBeDefined();
    expect(layoutReorder(false)).toBeDefined();
  });
});
