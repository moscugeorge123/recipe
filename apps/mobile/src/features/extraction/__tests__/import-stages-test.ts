import {
  importStageIndex,
  importStageLabel,
} from '@/features/extraction/import-stages';

describe('import stages', () => {
  test('switches stage at 0, 34, 66 and 94 percent', () => {
    expect(importStageLabel(0)).toBe('Reading the page');
    expect(importStageLabel(33.9)).toBe('Reading the page');
    expect(importStageLabel(34)).toBe('Picking out ingredients');
    expect(importStageLabel(65.9)).toBe('Picking out ingredients');
    expect(importStageLabel(66)).toBe('Writing the steps');
    expect(importStageLabel(94)).toBe('Plating it up');
    expect(importStageLabel(100)).toBe('Plating it up');
  });

  test('index follows the label', () => {
    expect(importStageIndex(0)).toBe(0);
    expect(importStageIndex(50)).toBe(1);
    expect(importStageIndex(99)).toBe(3);
  });
});
