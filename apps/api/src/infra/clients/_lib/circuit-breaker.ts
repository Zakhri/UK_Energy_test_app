import { UpstreamUnavailableError } from '../../../domain/errors.js';
import { logger } from '../../logger.js';

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitRecord {
  state: CircuitState;
  consecutiveFailures: number;
  openedAt: number;
}

export interface CircuitBreakerOptions {
  readonly failureThreshold: number;
  readonly resetAfterMs: number;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 3,
  resetAfterMs: 30_000,
};

export class CircuitBreaker {
  private readonly state = new Map<string, CircuitRecord>();

  constructor(private readonly options: CircuitBreakerOptions = DEFAULT_OPTIONS) {}

  async execute<T>(upstream: string, operation: () => Promise<T>): Promise<T> {
    const record = this.state.get(upstream) ?? {
      state: 'closed',
      consecutiveFailures: 0,
      openedAt: 0,
    };

    if (record.state === 'open') {
      const elapsed = Date.now() - record.openedAt;
      if (elapsed < this.options.resetAfterMs) {
        throw new UpstreamUnavailableError(`Circuit open for ${upstream}`, {
          upstream,
          retryAfterMs: this.options.resetAfterMs - elapsed,
        });
      }
      record.state = 'half-open';
      logger.info({ upstream }, 'circuit transitioning to half-open');
    }

    try {
      const result = await operation();
      if (record.state === 'half-open' || record.consecutiveFailures > 0) {
        logger.info({ upstream }, 'circuit closed after successful probe');
      }
      this.state.set(upstream, { state: 'closed', consecutiveFailures: 0, openedAt: 0 });
      return result;
    } catch (error) {
      record.consecutiveFailures += 1;
      if (
        record.consecutiveFailures >= this.options.failureThreshold ||
        record.state === 'half-open'
      ) {
        record.state = 'open';
        record.openedAt = Date.now();
        logger.warn({ upstream, failures: record.consecutiveFailures }, 'circuit opened');
      }
      this.state.set(upstream, record);
      throw error;
    }
  }

  /** Test-only: reset all circuit state. */
  reset(): void {
    this.state.clear();
  }
}

/** Shared singleton so all clients in one Lambda instance see the same state. */
export const sharedCircuitBreaker = new CircuitBreaker();
