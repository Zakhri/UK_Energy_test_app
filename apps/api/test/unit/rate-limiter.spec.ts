import { beforeEach, describe, expect, it } from 'vitest';

import { InMemoryCacheRepository } from '../../src/infra/cache/in-memory-cache.repository.js';
import { RateLimiter } from '../../src/infra/ai/rate-limiter.js';

describe('RateLimiter', () => {
  let cache: InMemoryCacheRepository;
  let limiter: RateLimiter;

  beforeEach(() => {
    cache = new InMemoryCacheRepository();
    limiter = new RateLimiter(cache, {
      modelId: 'gemini-2.5-flash',
      rpmLimit: 2,
      rpdLimit: 5,
      dailyBudgetUsd: 0.01,
    });
  });

  it('allows the first call', async () => {
    const decision = await limiter.check();
    expect(decision.allowed).toBe(true);
  });

  it('blocks after RPM limit is reached', async () => {
    await limiter.record(0);
    await limiter.record(0);
    const decision = await limiter.check();
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('rpm-exceeded');
    expect(decision.retryAfterMs).toBeGreaterThan(0);
  });

  it('blocks when daily budget is exhausted', async () => {
    const generousRpm = new RateLimiter(cache, {
      modelId: 'gemini-2.5-flash',
      rpmLimit: 100,
      rpdLimit: 100,
      dailyBudgetUsd: 0.01,
    });
    await generousRpm.record(0.005);
    await generousRpm.record(0.006);
    const decision = await generousRpm.check();
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('budget-exhausted');
  });
});
