/** Queue names are constants so splitting into multiple queues later is a config change only. */
export const QueueName = {
  EXTRACTION_JOBS: 'extraction-jobs',
} as const;

export type QueueName = (typeof QueueName)[keyof typeof QueueName];
