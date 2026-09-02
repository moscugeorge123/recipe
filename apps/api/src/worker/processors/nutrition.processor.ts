import type { AppContainer } from '../../shared/di/container.js';
import { NUTRITION_JOB_NAME } from '../../modules/nutrition/application/nutrition-service.js';
import type { BullMQQueueProvider } from '../../infrastructure/queues/bullmq/bullmq-queue-provider.js';

let activeQueue: BullMQQueueProvider | undefined;

export async function registerNutritionProcessor(container: AppContainer): Promise<void> {
  const queue = container.createNutritionQueue() as BullMQQueueProvider;

  queue.registerProcessor(NUTRITION_JOB_NAME, async (payload) => {
    await container.nutritionService.processSnapshot(payload.jobId);
  });

  activeQueue = queue;
}

export async function closeNutritionProcessor(): Promise<void> {
  await activeQueue?.close();
  activeQueue = undefined;
}