/**
 * Kept as the API-local import path for compatibility. The canonical machine-readable
 * contract lives in the shared package so mobile and API cannot drift.
 */
import { ErrorCode as SharedErrorCode } from '@recipe/contracts';
import type { ErrorCode as SharedErrorCodeType } from '@recipe/contracts';

export const ErrorCode = SharedErrorCode;
export type ErrorCode = SharedErrorCodeType;
