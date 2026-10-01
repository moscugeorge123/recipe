export interface CachedClassification {
  canonicalName: string;
  displayName: string;
  category: string;
  emoji: string;
  colorToken: string;
  confidence: number;
  source: 'dictionary' | 'ai' | 'fallback';
  promptVersion: string;
  /** Set when the amount was read from the phrase itself, not a leading number. */
  quantity?: number | null;
  unit?: string | null;
}

export interface ClassificationCache {
  get(key: string): Promise<CachedClassification | null>;
  set(key: string, value: CachedClassification): Promise<void>;
}

export function classificationCacheKey(
  normalizedText: string,
  locale: string,
  promptVersion: string,
): string {
  return `${promptVersion}:${locale}:${normalizedText.trim().toLowerCase()}`;
}

export class MemoryClassificationCache implements ClassificationCache {
  private readonly store = new Map<string, CachedClassification>();

  async get(key: string): Promise<CachedClassification | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: CachedClassification): Promise<void> {
    this.store.set(key, value);
  }
}

export class RedisBackedClassificationCache implements ClassificationCache {
  constructor(
    private readonly redis: { status: string; get(key: string): Promise<string | null>; set(key: string, value: string, ...args: unknown[]): Promise<unknown> },
    private readonly memory: ClassificationCache = new MemoryClassificationCache(),
    private readonly ttlSeconds = 60 * 60 * 24 * 30,
  ) {}

  async get(key: string): Promise<CachedClassification | null> {
    const memoryHit = await this.memory.get(key);
    if (memoryHit) {
      return memoryHit;
    }
    if (this.redis.status !== 'ready') {
      return null;
    }
    try {
      const raw = await this.redis.get(`pantry:class:${key}`);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as CachedClassification;
      await this.memory.set(key, parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  async set(key: string, value: CachedClassification): Promise<void> {
    await this.memory.set(key, value);
    if (this.redis.status !== 'ready') {
      return;
    }
    try {
      await this.redis.set(`pantry:class:${key}`, JSON.stringify(value), 'EX', this.ttlSeconds);
    } catch {
      // In-memory cache still holds the value for this process.
    }
  }
}
