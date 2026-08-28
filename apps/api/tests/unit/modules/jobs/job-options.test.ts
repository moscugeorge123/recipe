import { describe, expect, it } from 'vitest';

import { parseJobOptions } from '../../../../src/modules/jobs/domain/job-options.js';

describe('parseJobOptions', () => {
  it('defaults extractImages to true and others to false', () => {
    expect(parseJobOptions(undefined)).toEqual({
      extractNutrition: false,
      extractImages: true,
      highAccuracy: false,
    });
    expect(parseJobOptions({})).toEqual({
      extractNutrition: false,
      extractImages: true,
      highAccuracy: false,
    });
  });

  it('treats extractImages as true unless it is explicitly false', () => {
    expect(parseJobOptions({ extractImages: true }).extractImages).toBe(true);
    expect(parseJobOptions({ extractImages: false }).extractImages).toBe(false);
    expect(parseJobOptions({ extractImages: 'false' }).extractImages).toBe(true);
  });

  it('treats extractNutrition and highAccuracy as false unless explicitly true', () => {
    expect(parseJobOptions({ extractNutrition: true }).extractNutrition).toBe(true);
    expect(parseJobOptions({ extractNutrition: false }).extractNutrition).toBe(false);
    expect(parseJobOptions({ extractNutrition: 'true' }).extractNutrition).toBe(false);
    expect(parseJobOptions({ highAccuracy: true }).highAccuracy).toBe(true);
    expect(parseJobOptions({ highAccuracy: false }).highAccuracy).toBe(false);
  });
});
