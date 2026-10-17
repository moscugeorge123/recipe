import {
  DETAIL_TABS,
  activePanelHeight,
  descLayout,
  scrollAfterTabSwitch,
} from '../detail-layout';

describe('detail tabs', () => {
  test('the second tab is called Steps, never Method', () => {
    expect(DETAIL_TABS).toEqual(['Ingredients', 'Steps']);
  });
});

describe('activePanelHeight', () => {
  test('picks the measured height of the active panel', () => {
    expect(activePanelHeight([900, 300], 0)).toBe(900);
    expect(activePanelHeight([900, 300], 1)).toBe(300);
  });

  test('is undefined until the panel is measured', () => {
    expect(activePanelHeight([], 0)).toBeUndefined();
    expect(activePanelHeight([900], 1)).toBeUndefined();
    expect(activePanelHeight([0, 0], 1)).toBeUndefined();
  });
});

describe('descLayout', () => {
  const line = { height: 25.5 };

  test('a 2-line description has no toggle', () => {
    expect(descLayout([line, line]).truncated).toBe(false);
  });

  test('exactly 3 lines has no toggle', () => {
    expect(descLayout([line, line, line]).truncated).toBe(false);
  });

  test('a 6-line description is truncated to 3 lines', () => {
    const d = descLayout(Array(6).fill(line));
    expect(d.truncated).toBe(true);
    expect(d.clamped).toBe(77);
    expect(d.full).toBe(153);
  });
});

describe('scrollAfterTabSwitch', () => {
  test('jumps to the control when scrolled past it onto a shorter tab', () => {
    expect(scrollAfterTabSwitch(900, 400, 1200, 300)).toBe(400);
  });

  test('stays put when the control is still in view', () => {
    expect(scrollAfterTabSwitch(200, 400, 1200, 300)).toBeNull();
  });

  test('stays put when the new tab is taller or unmeasured', () => {
    expect(scrollAfterTabSwitch(900, 400, 300, 1200)).toBeNull();
    expect(scrollAfterTabSwitch(900, 400, undefined, 300)).toBeNull();
  });
});
