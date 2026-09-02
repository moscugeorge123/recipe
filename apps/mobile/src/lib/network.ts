import { ApiError } from '@/services/api-client';

export function isOfflineError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 0 || error.status >= 500;
  }
  return true;
}
