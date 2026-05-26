import { describe, expect, it, vi } from 'vitest';

import { withCache } from '../../src/infra/cache/cache.repository.js';
import { InMemoryCacheRepository } from '../../src/infra/cache/in-memory-cache.repository.js';

describe('InMemoryCacheRepository', () => {
  it('roundtrips a value within TTL', async () => {
    const repo = new InMemoryCacheRepository();
    const key = { pk: 'SRC#carbon#GB-LON', sk: 'BUCKET#2026-05-24T15:00' };
    await repo.put(key, { intensity: 142 }, 60);
    const got = await repo.get<{ intensity: number }>(key);
    expect(got?.value.intensity).toBe(142);
  });

  it('returns null after TTL expires', async () => {
    const repo = new InMemoryCacheRepository();
    const key = { pk: 'SRC#carbon#GB-LON', sk: 'BUCKET#x' };
    await repo.put(key, { intensity: 100 }, -1);
    expect(await repo.get(key)).toBeNull();
  });

  it('getStale returns expired entry within maxStaleSeconds', async () => {
    const repo = new InMemoryCacheRepository();
    const key = { pk: 'SRC#carbon#GB-LON', sk: 'BUCKET#x' };
    await repo.put(key, { value: 'old' }, -1);
    const stale = await repo.getStale<{ value: string }>(key, 3600);
    expect(stale?.value.value).toBe('old');
  });
});

describe('withCache', () => {
  it('uses cached value on hit', async () => {
    const repo = new InMemoryCacheRepository();
    const key = { pk: 'X', sk: 'Y' };
    const loader = vi.fn().mockResolvedValue('fresh');
    await repo.put(key, 'cached', 60);

    const result = await withCache(repo, key, loader, { ttlSeconds: 60 });
    expect(result.source).toBe('cache');
    expect(result.value).toBe('cached');
    expect(loader).not.toHaveBeenCalled();
  });

  it('falls through to loader on miss', async () => {
    const repo = new InMemoryCacheRepository();
    const key = { pk: 'X', sk: 'Y' };
    const loader = vi.fn().mockResolvedValue('fresh');

    const result = await withCache(repo, key, loader, { ttlSeconds: 60 });
    expect(result.source).toBe('fresh');
    expect(result.value).toBe('fresh');

    const cachedResult = await withCache(repo, key, loader, { ttlSeconds: 60 });
    expect(cachedResult.source).toBe('cache');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('returns stale on loader failure when maxStaleSeconds permits', async () => {
    const repo = new InMemoryCacheRepository();
    const key = { pk: 'X', sk: 'Y' };
    await repo.put(key, 'stale-data', -1);

    const loader = vi.fn().mockRejectedValue(new Error('upstream-down'));
    const result = await withCache(repo, key, loader, {
      ttlSeconds: 60,
      maxStaleSeconds: 3600,
    });
    expect(result.source).toBe('stale');
    expect(result.value).toBe('stale-data');
  });

  it('rethrows loader error when no stale entry is acceptable', async () => {
    const repo = new InMemoryCacheRepository();
    const key = { pk: 'X', sk: 'Y' };
    const loader = vi.fn().mockRejectedValue(new Error('upstream-down'));

    await expect(
      withCache(repo, key, loader, { ttlSeconds: 60, maxStaleSeconds: 3600 }),
    ).rejects.toThrow('upstream-down');
  });
});
