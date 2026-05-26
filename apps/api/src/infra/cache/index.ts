import type { AppConfig } from '../config.js';
import type { CacheRepository } from './cache.repository.js';
import { DynamoCacheRepository } from './dynamo-cache.repository.js';
import { InMemoryCacheRepository } from './in-memory-cache.repository.js';

export type { CacheEntry, CacheKey, CacheRepository, IteratedEntry } from './cache.repository.js';
export { withCache } from './cache.repository.js';
export { InMemoryCacheRepository } from './in-memory-cache.repository.js';
export { DynamoCacheRepository } from './dynamo-cache.repository.js';

let cachedRepo: CacheRepository | null = null;

export function buildCacheRepository(config: AppConfig): CacheRepository {
  if (cachedRepo) return cachedRepo;

  const useInMemory =
    !config.dynamoEndpoint || config.dynamoEndpoint === 'memory' || process.env.NODE_ENV === 'test';

  cachedRepo = useInMemory
    ? new InMemoryCacheRepository()
    : new DynamoCacheRepository({
        tableName: config.dynamoTable,
        ...(config.dynamoEndpoint ? { endpoint: config.dynamoEndpoint } : {}),
      });

  return cachedRepo;
}

export function __resetCacheRepository(): void {
  cachedRepo = null;
}
