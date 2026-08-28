import {
  extractionHeadline,
  isFailedJobStatus,
  isTerminalJobStatus,
  mapJobToUiStage,
} from '@/features/extraction/stage-map';

describe('extraction stage map', () => {
  test('maps API statuses onto ui stages 0-5', () => {
    expect(mapJobToUiStage('QUEUED', null)).toBe(0);
    expect(mapJobToUiStage('ACQUIRING_CONTENT', 'ACQUIRING_CONTENT')).toBe(0);
    expect(mapJobToUiStage('CONTENT_ACQUIRED', 'CONTENT_ACQUIRED')).toBe(1);
    expect(mapJobToUiStage('TRANSCRIBING', 'TRANSCRIBING')).toBe(2);
    expect(mapJobToUiStage('RUNNING_OCR', 'RUNNING_OCR')).toBe(3);
    expect(mapJobToUiStage('EXTRACTING_RECIPE', 'EXTRACTING_RECIPE')).toBe(4);
    expect(mapJobToUiStage('NORMALIZING_RECIPE', 'NORMALIZING_RECIPE')).toBe(5);
    expect(mapJobToUiStage('COMPLETED', 'VALIDATING_RECIPE')).toBe(5);
  });

  test('headlines follow the prototype copy', () => {
    expect(extractionHeadline(0)).toBe('Pulling the recipe out.');
    expect(extractionHeadline(3)).toBe('Putting it in order.');
    expect(extractionHeadline(5)).toBe('Your recipe is ready.');
  });

  test('terminal and failed flags', () => {
    expect(isTerminalJobStatus('COMPLETED')).toBe(true);
    expect(isTerminalJobStatus('QUEUED')).toBe(false);
    expect(isFailedJobStatus('FAILED')).toBe(true);
    expect(isFailedJobStatus('CANCELLED')).toBe(true);
    expect(isFailedJobStatus('COMPLETED')).toBe(false);
  });
});
