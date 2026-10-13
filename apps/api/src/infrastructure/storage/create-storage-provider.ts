import type { AppConfig } from '../../config/env.js';
import { LocalStorageProvider } from './local/local-storage-provider.js';
import { S3StorageProvider } from './s3/s3-storage-provider.js';
import type { StorageProvider } from './storage-provider.js';

export function createStorageProvider(config: AppConfig): StorageProvider {
  if (config.storage.provider === 's3' && config.storage.s3) {
    const s3Config = config.storage.s3;
    return new S3StorageProvider({
      bucket: s3Config.bucket,
      region: s3Config.region,
      ...(s3Config.endpoint ? { endpoint: s3Config.endpoint } : {}),
    });
  }
  return new LocalStorageProvider(config.storage.localPath);
}
