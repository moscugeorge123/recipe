/**
 * Queue abstraction implemented by BullMQ today and swappable to SQS later.
 * The full adapter ships in Phase 4; this interface establishes the contract.
 */

export interface JobPayload {
  jobId: string;
}

export interface EnqueueOptions {
  delayMs?: number;
  attempts?: number;
}

export type JobHandler = (payload: JobPayload) => Promise<void>;

export interface QueueProvider {
  enqueue(jobName: string, payload: JobPayload, opts?: EnqueueOptions): Promise<void>;
  registerProcessor(name: string, handler: JobHandler): void;
  close(): Promise<void>;
}
