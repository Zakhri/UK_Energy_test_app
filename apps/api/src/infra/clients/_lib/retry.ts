import { logger } from '../../logger.js';

export interface RetryOptions {
  readonly attempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly jitterMs?: number;
  readonly shouldRetry?: (error: unknown, attempt: number) => boolean;
  readonly operationName?: string;
}

const DEFAULT_OPTIONS: Required<Pick<RetryOptions, 'attempts' | 'baseDelayMs' | 'maxDelayMs'>> = {
  attempts: 3,
  baseDelayMs: 200,
  maxDelayMs: 4000,
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === config.attempts;
      const shouldRetry = options.shouldRetry?.(error, attempt) ?? true;

      if (isLastAttempt || !shouldRetry) {
        throw error;
      }

      const exponentialDelay = Math.min(
        config.maxDelayMs,
        config.baseDelayMs * Math.pow(2, attempt - 1),
      );
      const jitter = options.jitterMs ?? Math.floor(Math.random() * 200);
      const delay = exponentialDelay + jitter;

      logger.warn(
        {
          operation: options.operationName,
          attempt,
          nextDelayMs: delay,
          err: error instanceof Error ? error.message : String(error),
        },
        'retry attempt failed, backing off',
      );

      await sleep(delay);
    }
  }

  throw lastError;
}
