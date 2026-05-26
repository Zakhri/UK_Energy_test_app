import { describe, expect, it, vi } from 'vitest';

import { withRetry } from '../../src/infra/clients/_lib/retry.js';

describe('withRetry', () => {
  it('returns the first successful result without retrying', async () => {
    const operation = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(operation, { attempts: 3, baseDelayMs: 1, maxDelayMs: 1 });
    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries until success', async () => {
    let calls = 0;
    const operation = vi.fn().mockImplementation(async () => {
      calls += 1;
      if (calls < 3) throw new Error('transient');
      return 'success';
    });

    const result = await withRetry(operation, { attempts: 5, baseDelayMs: 1, maxDelayMs: 1 });
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('rethrows after exhausting attempts', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('permanent'));
    await expect(
      withRetry(operation, { attempts: 2, baseDelayMs: 1, maxDelayMs: 1 }),
    ).rejects.toThrow('permanent');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('respects shouldRetry predicate (fail-fast on non-retryable errors)', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('do-not-retry'));
    await expect(
      withRetry(operation, {
        attempts: 5,
        baseDelayMs: 1,
        maxDelayMs: 1,
        shouldRetry: () => false,
      }),
    ).rejects.toThrow('do-not-retry');
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
