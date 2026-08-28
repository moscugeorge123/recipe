import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import type { Redis } from 'ioredis';

import type { EnqueueOptions, JobHandler, JobPayload, QueueProvider } from './queue-provider.js';

export class BullMQQueueProvider implements QueueProvider {
  private readonly queue: Queue;
  private worker: Worker | undefined;

  constructor(
    private readonly queueName: string,
    private readonly connection: Redis | ConnectionOptions,
    private readonly concurrency: number,
    private readonly defaultBackoffMs: number,
    private readonly defaultAttempts: number,
  ) {
    this.queue = new Queue(queueName, { connection });
  }

  async enqueue(jobName: string, payload: JobPayload, opts?: EnqueueOptions): Promise<void> {
    await this.queue.add(jobName, payload, {
      attempts: opts?.attempts ?? this.defaultAttempts,
      backoff: {
        type: 'exponential',
        delay: this.defaultBackoffMs,
      },
      ...(opts?.delayMs !== undefined ? { delay: opts.delayMs } : {}),
    });
  }

  registerProcessor(name: string, handler: JobHandler): void {
    if (this.worker) {
      throw new Error('Processor already registered');
    }

    this.worker = new Worker(
      this.queueName,
      async (job) => {
        if (job.name !== name) {
          throw new Error(`Unexpected job name: ${job.name}`);
        }
        await handler(job.data as JobPayload);
      },
      {
        connection: this.connection,
        concurrency: this.concurrency,
      },
    );
  }

  async close(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
  }
}

/** Defers BullMQ connection until the first enqueue/processor registration. */
export class LazyQueueProvider implements QueueProvider {
  private delegate: QueueProvider | undefined;

  constructor(private readonly factory: () => QueueProvider) {}

  private getDelegate(): QueueProvider {
    this.delegate ??= this.factory();
    return this.delegate;
  }

  enqueue(jobName: string, payload: JobPayload, opts?: EnqueueOptions): Promise<void> {
    return this.getDelegate().enqueue(jobName, payload, opts);
  }

  registerProcessor(name: string, handler: JobHandler): void {
    this.getDelegate().registerProcessor(name, handler);
  }

  close(): Promise<void> {
    return this.delegate?.close() ?? Promise.resolve();
  }
}

/** In-process queue for tests — runs handlers synchronously on enqueue. */
export class InMemoryQueueProvider implements QueueProvider {
  private readonly handlers = new Map<string, JobHandler>();

  async enqueue(jobName: string, payload: JobPayload, opts?: EnqueueOptions): Promise<void> {
    void opts;
    const handler = this.handlers.get(jobName);
    if (!handler) {
      throw new Error(`No handler registered for job: ${jobName}`);
    }
    await handler(payload);
  }

  registerProcessor(name: string, handler: JobHandler): void {
    this.handlers.set(name, handler);
  }

  async close(): Promise<void> {
    this.handlers.clear();
  }
}
