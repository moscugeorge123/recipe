import { describe, expect, it } from 'vitest';

import { createExtractionJobBodySchema } from '../../../../src/modules/jobs/api/jobs.schema.js';
import { parseJobOptions } from '../../../../src/modules/jobs/domain/job-options.js';

describe('parseJobOptions', () => {
  it('defaults extractImages to true and highAccuracy to false', () => {
    expect(parseJobOptions(undefined)).toEqual({
      extractImages: true,
      highAccuracy: false,
    });
    expect(parseJobOptions({})).toEqual({
      extractImages: true,
      highAccuracy: false,
    });
  });

  it('treats extractImages as true unless it is explicitly false', () => {
    expect(parseJobOptions({ extractImages: true }).extractImages).toBe(true);
    expect(parseJobOptions({ extractImages: false }).extractImages).toBe(false);
    expect(parseJobOptions({ extractImages: 'false' }).extractImages).toBe(true);
  });

  it('treats highAccuracy as false unless explicitly true', () => {
    expect(parseJobOptions({ highAccuracy: true }).highAccuracy).toBe(true);
    expect(parseJobOptions({ highAccuracy: false }).highAccuracy).toBe(false);
  });

  it('ignores the retired extractNutrition flag stored on older jobs', () => {
    expect(parseJobOptions({ extractNutrition: true })).toEqual({
      extractImages: true,
      highAccuracy: false,
    });
  });

  it('parses selectedThumbnailUrl when it is a non-empty string', () => {
    expect(parseJobOptions({}).selectedThumbnailUrl).toBeUndefined();
    expect(parseJobOptions({ selectedThumbnailUrl: '' }).selectedThumbnailUrl).toBeUndefined();
    expect(parseJobOptions({ selectedThumbnailUrl: 1 }).selectedThumbnailUrl).toBeUndefined();
    expect(
      parseJobOptions({ selectedThumbnailUrl: 'https://example.com/chosen.jpg' }).selectedThumbnailUrl,
    ).toBe('https://example.com/chosen.jpg');
  });
});

describe('createExtractionJobBodySchema', () => {
  it('still accepts older clients that send extractNutrition, and drops it', () => {
    const parsed = createExtractionJobBodySchema.parse({
      url: 'https://example.com/recipe',
      options: { extractNutrition: false, extractImages: true },
    });
    expect(parsed.options).toEqual({ extractImages: true, highAccuracy: false });
  });
});
