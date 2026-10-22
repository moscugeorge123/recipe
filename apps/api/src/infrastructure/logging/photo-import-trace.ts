import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

/** Daily file that receives every step and payload of a picture import. */
export const PHOTO_IMPORT_LOG_FILE = 'photo-import';

export type PhotoImportTracePhase = 'started' | 'completed' | 'failed' | 'skipped';

export interface PhotoImportTraceEvent {
  jobId?: string | undefined;
  step: string;
  phase: PhotoImportTracePhase;
  data?: unknown;
  error?: unknown;
}

let logDirectory: string | undefined;

/**
 * Turns the picture-import trace on. The API and worker both call this from `createLogger`.
 * Tests and a missing `LOG_DIR` leave it off, so a trace call never touches disk.
 */
export function configurePhotoImportTrace(directory: string | undefined): void {
  logDirectory = directory || undefined;
}

export function photoImportLogPath(now = new Date()): string | undefined {
  if (!logDirectory) return undefined;
  const day = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  return path.join(logDirectory, `${PHOTO_IMPORT_LOG_FILE}.${day}.log`);
}

/**
 * Appends one JSON line to the picture-import log. Image bytes stay in storage; callers pass
 * keys, sizes, and the text the pipeline actually used. A logging failure never fails the import.
 */
export function tracePhotoImport(event: PhotoImportTraceEvent): void {
  const file = photoImportLogPath();
  if (!file) return;

  const line = {
    time: new Date().toISOString(),
    jobId: event.jobId ?? null,
    step: event.step,
    phase: event.phase,
    ...(event.data !== undefined ? { data: event.data } : {}),
    ...(event.error !== undefined ? { error: serializeTraceError(event.error) } : {}),
  };

  try {
    mkdirSync(path.dirname(file), { recursive: true });
    appendFileSync(file, `${JSON.stringify(line)}\n`);
  } catch {
    // The import is the work that matters. A full disk must not fail it.
  }
}

function serializeTraceError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
    };
  }
  return { message: String(error) };
}
