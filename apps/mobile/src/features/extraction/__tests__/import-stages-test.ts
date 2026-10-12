import {
  importStageIndex,
  importStageLabel,
} from '@/features/extraction/import-stages';

describe('import stages', () => {
  test('switches stage at 0, 18, 34, 66 and 94 percent', () => {
    expect(importStageLabel(0)).toBe('Reading the page');
    expect(importStageLabel(17.9)).toBe('Reading the page');
    expect(importStageLabel(18)).toBe('Grabbing the photo');
    expect(importStageLabel(34)).toBe('Picking out ingredients');
    expect(importStageLabel(65.9)).toBe('Picking out ingredients');
    expect(importStageLabel(66)).toBe('Writing the steps');
    expect(importStageLabel(94)).toBe('Plating it up');
    expect(importStageLabel(100)).toBe('Plating it up');
  });

  test('index follows the label', () => {
    expect(importStageIndex(0)).toBe(0);
    expect(importStageIndex(50)).toBe(2);
    expect(importStageIndex(99)).toBe(4);
  });
});
