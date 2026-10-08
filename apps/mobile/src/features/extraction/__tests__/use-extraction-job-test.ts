import { extractionPollInterval } from '@/features/extraction/hooks/use-extraction-job';
import { ApiError } from '@/services/api-client';

describe('extractionPollInterval', () => {
  test('polls in-flight jobs every five seconds', () => {
    expect(extractionPollInterval({ status: 'EXTRACTING_RECIPE' })).toBe(5000);
  });

  test('stops polling once the job is terminal', () => {
    expect(extractionPollInterval({ status: 'COMPLETED' })).toBe(false);
    expect(extractionPollInterval({ status: 'FAILED' })).toBe(false);
    expect(extractionPollInterval({ status: 'CANCELLED' })).toBe(false);
  });

  test('backs off when the API rate-limits the poll', () => {
    const error = new ApiError(
      'Rate limit exceeded',
      429,
      null,
      'TOO_MANY_REQUESTS',
    );
    expect(extractionPollInterval({ status: 'QUEUED', error })).toBe(5000);
  });
});
