export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_MEDIA_TYPE",
  UNPROCESSABLE_ENTITY: "UNPROCESSABLE_ENTITY",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  UNSUPPORTED_SOURCE: "UNSUPPORTED_SOURCE",
  INVALID_URL: "INVALID_URL",
  JOB_NOT_FOUND: "JOB_NOT_FOUND",
  RECIPE_NOT_FOUND: "RECIPE_NOT_FOUND",
  RECIPE_REVISION_CONFLICT: "RECIPE_REVISION_CONFLICT",
  RECIPE_ENGAGEMENT_CONFLICT: "RECIPE_ENGAGEMENT_CONFLICT",
  RECIPE_NOTE_NOT_FOUND: "RECIPE_NOTE_NOT_FOUND",
  CATEGORY_NOT_FOUND: "CATEGORY_NOT_FOUND",
  COOK_SESSION_NOT_FOUND: "COOK_SESSION_NOT_FOUND",
  COLLECTION_NOT_FOUND: "COLLECTION_NOT_FOUND",
  COLLECTION_NAME_CONFLICT: "COLLECTION_NAME_CONFLICT",
  COLLECTION_RECIPE_CONFLICT: "COLLECTION_RECIPE_CONFLICT",
  COLLECTION_MEMBER_NOT_FOUND: "COLLECTION_MEMBER_NOT_FOUND",
  JOB_ALREADY_COMPLETED: "JOB_ALREADY_COMPLETED",
  JOB_CANCELLED: "JOB_CANCELLED",
  EXTRACTION_FAILED: "EXTRACTION_FAILED",
  CONTENT_ACQUISITION_FAILED: "CONTENT_ACQUISITION_FAILED",
  MEDIA_PROCESSING_FAILED: "MEDIA_PROCESSING_FAILED",
  PROVIDER_RATE_LIMITED: "PROVIDER_RATE_LIMITED",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ErrorDetail {
  path: string;
  message: string;
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: ErrorDetail[];
  requestId?: string;
  retryable?: boolean;
}

export interface ErrorResponse {
  error: ApiError;
}

export const RetryableHttpStatus = [429, 503] as const;
export type RetryableHttpStatus = (typeof RetryableHttpStatus)[number];

const RETRYABLE_ERROR_CODES = new Set<string>([
  ErrorCode.TOO_MANY_REQUESTS,
  ErrorCode.SERVICE_UNAVAILABLE,
  ErrorCode.INTERNAL_SERVER_ERROR,
  ErrorCode.PROVIDER_RATE_LIMITED,
  ErrorCode.EXTRACTION_FAILED,
  ErrorCode.CONTENT_ACQUISITION_FAILED,
  ErrorCode.MEDIA_PROCESSING_FAILED,
]);

export function isRetryableErrorCode(code: string | undefined): boolean {
  return !!code && RETRYABLE_ERROR_CODES.has(code);
}

/** User-facing retry: rate limits, outages, and 5xx. 4xx conflicts/not-found are not retryable. */
export function isRetryableFailure(
  status: number,
  code?: string,
): boolean {
  if (status === 429 || status === 503 || status >= 500) {
    return true;
  }
  return isRetryableErrorCode(code);
}
