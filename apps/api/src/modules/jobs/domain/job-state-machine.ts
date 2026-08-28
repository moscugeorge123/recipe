import type { JobStatus } from '@prisma/client';

import { AppError } from '../../../shared/errors/app-error.js';
import { ErrorCode } from '../../../shared/errors/error-codes.js';
import { CANCELLABLE_STATUSES } from './job-status.js';

const VALID_TRANSITIONS: Readonly<Record<JobStatus, readonly JobStatus[]>> = {
  QUEUED: ['ACQUIRING_CONTENT', 'CANCELLED', 'FAILED'],
  ACQUIRING_CONTENT: ['CONTENT_ACQUIRED', 'CANCELLED', 'FAILED'],
  CONTENT_ACQUIRED: ['PROCESSING_MEDIA', 'CANCELLED', 'FAILED'],
  PROCESSING_MEDIA: ['TRANSCRIBING', 'CANCELLED', 'FAILED'],
  TRANSCRIBING: ['ANALYZING_FRAMES', 'FAILED'],
  ANALYZING_FRAMES: ['RUNNING_OCR', 'FAILED'],
  RUNNING_OCR: ['EXTRACTING_RECIPE', 'FAILED'],
  EXTRACTING_RECIPE: ['NORMALIZING_RECIPE', 'FAILED'],
  NORMALIZING_RECIPE: ['VALIDATING_RECIPE', 'FAILED'],
  VALIDATING_RECIPE: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: ['QUEUED'],
  CANCELLED: [],
};

export class JobStateMachine {
  assertTransition(from: JobStatus, to: JobStatus): void {
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed.includes(to)) {
      throw new AppError({
        code: ErrorCode.EXTRACTION_FAILED,
        statusCode: 500,
        message: `Invalid job status transition: ${from} -> ${to}`,
      });
    }
  }

  canCancel(status: JobStatus): boolean {
    return CANCELLABLE_STATUSES.has(status);
  }

  isTerminal(status: JobStatus): boolean {
    return status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED';
  }
}
