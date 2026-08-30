const TERMINAL = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

const STAGE_MAP: Record<string, number> = {
  QUEUED: 0,
  ACQUIRING_CONTENT: 0,
  CONTENT_ACQUIRED: 1,
  PROCESSING_MEDIA: 1,
  TRANSCRIBING: 2,
  ANALYZING_FRAMES: 2,
  RUNNING_OCR: 3,
  EXTRACTING_RECIPE: 4,
  NORMALIZING_RECIPE: 5,
  VALIDATING_RECIPE: 5,
  COMPLETED: 5,
};

export const EXTRACTION_STEP_LABELS = [
  'Post captured',
  'Title found',
  'Reading ingredients',
  'Understanding the steps',
  'Working out servings',
  'Tidying units',
] as const;

export function mapJobToUiStage(
  status: string,
  currentStage: string | null,
): number {
  if (status === 'COMPLETED') {
    return 5;
  }
  const key = currentStage ?? status;
  return STAGE_MAP[key] ?? STAGE_MAP[status] ?? 0;
}

export function isTerminalJobStatus(status: string): boolean {
  return TERMINAL.has(status);
}

export function isFailedJobStatus(status: string): boolean {
  return status === 'FAILED' || status === 'CANCELLED';
}
