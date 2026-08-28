import type { AppContainer } from '../../shared/di/container.js';
import { EXTRACTION_JOB_NAME } from '../../modules/jobs/application/extraction-job.service.js';
import type { BullMQQueueProvider } from '../../infrastructure/queues/bullmq/bullmq-queue-provider.js';

let activeQueue: BullMQQueueProvider | undefined;

/**
 * Registers the BullMQ worker that executes RecipeExtractionPipeline for each job.
 */
export async function registerExtractionProcessor(container: AppContainer): Promise<void> {
  const queue = container.createQueue() as BullMQQueueProvider;

  queue.registerProcessor(EXTRACTION_JOB_NAME, async (payload) => {
    await container.pipeline.execute(payload.jobId);
  });

  activeQueue = queue;
}

export async function closeExtractionProcessor(): Promise<void> {
  await activeQueue?.close();
  activeQueue = undefined;
}
