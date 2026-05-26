export interface CacheEntry<T> {
  readonly value: T;
  readonly fetchedAt: number;
  readonly expiresAt: number;
}

export interface IteratedEntry<T> extends CacheEntry<T> {
  readonly key: CacheKey;
}

export interface CacheRepository {
  get<T>(key: CacheKey): Promise<CacheEntry<T> | null>;
  put<T>(key: CacheKey, value: T, ttlSeconds: number): Promise<void>;

  getStale<T>(key: CacheKey, maxStaleSeconds: number): Promise<CacheEntry<T> | null>;
  delete(key: CacheKey): Promise<void>;

  iterate<T>(pkPrefix: string): Promise<readonly IteratedEntry<T>[]>;
}

export interface CacheKey {
  readonly pk: string;
  readonly sk: string;
}

export interface WithCacheOptions {
  readonly ttlSeconds: number;
  readonly maxStaleSeconds?: number;
}

export type WithCacheResult<T> =
  | { readonly value: T; readonly source: 'fresh' | 'cache' }
  | { readonly value: T; readonly source: 'stale'; readonly stalenessSeconds: number };

export async function withCache<T>(
  repo: CacheRepository,
  key: CacheKey,
  loader: () => Promise<T>,
  options: WithCacheOptions,
): Promise<WithCacheResult<T>> {
  const cached = await repo.get<T>(key);
  if (cached) {
    return { value: cached.value, source: 'cache' };
  }

  try {
    const value = await loader();
    await repo.put(key, value, options.ttlSeconds);
    return { value, source: 'fresh' };
  } catch (loaderError) {
    if (options.maxStaleSeconds) {
      const stale = await repo.getStale<T>(key, options.maxStaleSeconds);
      if (stale) {
        const stalenessSeconds = Math.floor((Date.now() - stale.fetchedAt) / 1000);
        return { value: stale.value, source: 'stale', stalenessSeconds };
      }
    }
    throw loaderError;
  }
}
