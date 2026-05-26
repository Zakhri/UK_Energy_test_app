import type { CacheEntry, CacheKey, CacheRepository, IteratedEntry } from './cache.repository.js';

interface StoredEntry {
  readonly value: unknown;
  readonly fetchedAt: number;
  readonly expiresAt: number;
}

const compositeKey = (key: CacheKey): string => `${key.pk}|${key.sk}`;

/**
 * Process-local cache for dev + tests. No TTL eviction beyond filtering on
 * read — fine for short-lived processes.
 */
export class InMemoryCacheRepository implements CacheRepository {
  private readonly store = new Map<string, StoredEntry>();

  async get<T>(key: CacheKey): Promise<CacheEntry<T> | null> {
    const entry = this.store.get(compositeKey(key));
    if (!entry) return null;
    if (entry.expiresAt < Math.floor(Date.now() / 1000)) return null;
    return entry as CacheEntry<T>;
  }

  async put<T>(key: CacheKey, value: T, ttlSeconds: number): Promise<void> {
    const now = Date.now();
    this.store.set(compositeKey(key), {
      value,
      fetchedAt: now,
      expiresAt: Math.floor(now / 1000) + ttlSeconds,
    });
  }

  async getStale<T>(key: CacheKey, maxStaleSeconds: number): Promise<CacheEntry<T> | null> {
    const entry = this.store.get(compositeKey(key));
    if (!entry) return null;
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiredFor = nowSeconds - entry.expiresAt;
    if (expiredFor > maxStaleSeconds) return null;
    return entry as CacheEntry<T>;
  }

  async delete(key: CacheKey): Promise<void> {
    this.store.delete(compositeKey(key));
  }

  async iterate<T>(pkPrefix: string): Promise<readonly IteratedEntry<T>[]> {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const results: IteratedEntry<T>[] = [];
    for (const [composite, entry] of this.store) {
      if (!composite.startsWith(`${pkPrefix}`)) continue;
      if (entry.expiresAt < nowSeconds) continue;
      const [pk, sk] = composite.split('|', 2) as [string, string];
      results.push({
        key: { pk, sk },
        value: entry.value as T,
        fetchedAt: entry.fetchedAt,
        expiresAt: entry.expiresAt,
      });
    }
    return results;
  }

  /** Test-only: clear all entries. */
  clear(): void {
    this.store.clear();
  }
}
