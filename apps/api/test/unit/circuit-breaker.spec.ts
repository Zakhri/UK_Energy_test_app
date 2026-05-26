import { beforeEach, describe, expect, it } from 'vitest';

import { UpstreamUnavailableError } from '../../src/domain/errors.js';
import { CircuitBreaker } from '../../src/infra/clients/_lib/circuit-breaker.js';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({ failureThreshold: 2, resetAfterMs: 1_000 });
  });

  it('passes through successful operations', async () => {
    const result = await breaker.execute('upstream-a', async () => 'ok');
    expect(result).toBe('ok');
  });

  it('opens after failure threshold and rejects subsequent calls', async () => {
    const failing = async (): Promise<never> => {
      throw new Error('boom');
    };

    await expect(breaker.execute('upstream-a', failing)).rejects.toThrow('boom');
    await expect(breaker.execute('upstream-a', failing)).rejects.toThrow('boom');

    await expect(breaker.execute('upstream-a', failing)).rejects.toBeInstanceOf(
      UpstreamUnavailableError,
    );
  });

  it('closes after a successful half-open probe', async () => {
    const failing = async (): Promise<never> => {
      throw new Error('boom');
    };
    await expect(breaker.execute('upstream-a', failing)).rejects.toThrow();
    await expect(breaker.execute('upstream-a', failing)).rejects.toThrow();

    breaker = new CircuitBreaker({ failureThreshold: 2, resetAfterMs: 0 });
    await expect(breaker.execute('upstream-a', failing)).rejects.toThrow();
    await expect(breaker.execute('upstream-a', failing)).rejects.toThrow();

    const result = await breaker.execute('upstream-a', async () => 'recovered');
    expect(result).toBe('recovered');
  });

  it('keeps state independent per upstream', async () => {
    const failing = async (): Promise<never> => {
      throw new Error('boom');
    };
    await expect(breaker.execute('upstream-a', failing)).rejects.toThrow();
    await expect(breaker.execute('upstream-a', failing)).rejects.toThrow();

    const result = await breaker.execute('upstream-b', async () => 'fine');
    expect(result).toBe('fine');
  });
});
