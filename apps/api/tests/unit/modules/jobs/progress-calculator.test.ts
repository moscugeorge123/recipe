import { describe, expect, it } from 'vitest';

import { ProgressCalculator } from '../../../../src/modules/jobs/application/progress-calculator.js';
import { PIPELINE_STAGE_ORDER } from '../../../../src/modules/jobs/domain/job-status.js';

describe('ProgressCalculator', () => {
  const calculator = new ProgressCalculator(PIPELINE_STAGE_ORDER);

  it('returns cumulative progress after each stage', () => {
    expect(calculator.afterStageCompleted('ACQUIRING_CONTENT')).toBe(10);
    expect(calculator.afterStageCompleted('PROCESSING_MEDIA')).toBe(25);
    expect(calculator.afterStageCompleted('VALIDATING_RECIPE')).toBe(100);
  });

  it('returns midpoint progress while a stage is running', () => {
    expect(calculator.whileStageRunning('ACQUIRING_CONTENT')).toBe(5);
    expect(calculator.whileStageRunning('PROCESSING_MEDIA')).toBe(18);
  });
});
