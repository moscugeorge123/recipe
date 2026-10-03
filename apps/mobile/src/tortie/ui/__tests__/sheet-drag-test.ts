import { sheetDragDecision } from '@/tortie/ui/sheet-drag';

const base = {
  dx: 0,
  dy: 20,
  contentH: 800,
  viewH: 400,
  scrollY: 0,
  scrollActive: false,
};

describe('sheetDragDecision', () => {
  test('pulls a sheet that does not scroll', () => {
    expect(sheetDragDecision({ ...base, contentH: 200, viewH: 400 })).toBe(
      'activate',
    );
    expect(sheetDragDecision({ ...base, contentH: 0, viewH: 0 })).toBe(
      'activate',
    );
  });

  test('pulls when the scroll is already at the top', () => {
    expect(sheetDragDecision(base)).toBe('activate');
    expect(sheetDragDecision({ ...base, scrollY: 1 })).toBe('activate');
  });

  test('waits for a scroller that still has room, then the sheet can take over', () => {
    expect(
      sheetDragDecision({ ...base, scrollY: 40, scrollActive: true }),
    ).toBe('wait');
    expect(sheetDragDecision({ ...base, scrollY: 1, scrollActive: true })).toBe(
      'activate',
    );
  });

  test('pulls from outside the scroller once the drag is clearly downward', () => {
    expect(
      sheetDragDecision({ ...base, dy: 12, scrollY: 40, scrollActive: false }),
    ).toBe('wait');
    expect(
      sheetDragDecision({ ...base, dy: 20, scrollY: 40, scrollActive: false }),
    ).toBe('activate');
  });

  test('waits until the scroller has been measured', () => {
    expect(sheetDragDecision({ ...base, contentH: -1, viewH: -1 })).toBe(
      'wait',
    );
  });

  test('ignores upward and horizontal drags', () => {
    expect(sheetDragDecision({ ...base, dy: -20 })).toBe('fail');
    expect(sheetDragDecision({ ...base, dx: 40, dy: 10 })).toBe('fail');
    expect(sheetDragDecision({ ...base, dy: 4 })).toBe('wait');
  });
});
