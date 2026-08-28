import type { JobStatus, PipelineStage } from '@prisma/client';

/** Job statuses that may be cancelled by the client. */
export const CANCELLABLE_STATUSES: ReadonlySet<JobStatus> = new Set([
  'QUEUED',
  'ACQUIRING_CONTENT',
  'CONTENT_ACQUIRED',
  'PROCESSING_MEDIA',
]);

/** Maps a pipeline stage to the job status shown while that stage runs. */
export const STAGE_TO_JOB_STATUS: Record<PipelineStage, JobStatus> = {
  ACQUIRING_CONTENT: 'ACQUIRING_CONTENT',
  PROCESSING_MEDIA: 'PROCESSING_MEDIA',
  TRANSCRIBING: 'TRANSCRIBING',
  ANALYZING_FRAMES: 'ANALYZING_FRAMES',
  RUNNING_OCR: 'RUNNING_OCR',
  EXTRACTING_RECIPE: 'EXTRACTING_RECIPE',
  NORMALIZING_RECIPE: 'NORMALIZING_RECIPE',
  VALIDATING_RECIPE: 'VALIDATING_RECIPE',
};

/** Job status set after content acquisition completes, before media processing. */
export const CONTENT_ACQUIRED_STATUS: JobStatus = 'CONTENT_ACQUIRED';

/** Ordered pipeline stages for the extraction flow. */
export const PIPELINE_STAGE_ORDER: readonly PipelineStage[] = [
  'ACQUIRING_CONTENT',
  'PROCESSING_MEDIA',
  'TRANSCRIBING',
  'ANALYZING_FRAMES',
  'RUNNING_OCR',
  'EXTRACTING_RECIPE',
  'NORMALIZING_RECIPE',
  'VALIDATING_RECIPE',
] as const;
