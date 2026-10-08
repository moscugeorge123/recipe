import {
  blockAfterSettle,
  blockOnDragEnd,
  blockOnDragStart,
  sheetPressCommits,
} from '@/tortie/ui/sheet-press';

describe('sheet press block', () => {
  test('a drag blocks the button, including the press as the sheet closes', () => {
    const dragging = blockOnDragStart();
    expect(sheetPressCommits(dragging)).toBe(false);
    expect(sheetPressCommits(blockOnDragEnd(true))).toBe(false);
  });

  test('a drag that snaps back blocks only the lift, then accepts a later tap', () => {
    const settling = blockOnDragEnd(false);
    expect(sheetPressCommits(settling)).toBe(false);
    expect(sheetPressCommits(blockAfterSettle(settling))).toBe(true);
  });

  test('dismiss stays blocked until the sheet opens again', () => {
    expect(blockAfterSettle(blockOnDragEnd(true))).toBe('dismissed');
  });
});