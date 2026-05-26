import { ulid } from 'ulid';

import type { CacheRepository } from '../cache/index.js';
import { logger } from '../logger.js';

export interface AiCallTelemetry {
  readonly requestId: string;
  readonly modelId: string;
  readonly promptVersion: string;
  readonly promptHash: string;
  readonly latencyMs: number;
  readonly promptTokens: number;
  readonly outputTokens: number;
  readonly thoughtsTokens: number;
  readonly cachedInputTokens: number;
  readonly costUsd: number;
  readonly cacheHit: boolean;
  readonly schemaValid: boolean;
  readonly refused: boolean;
  readonly degraded: boolean;
  readonly confidenceOverall: number;
  readonly fallbackUsed?: string;
  readonly errorClass?: string;
}

export class TelemetryRecorder {
  constructor(private readonly cache: CacheRepository | null) {}

  async record(event: AiCallTelemetry): Promise<void> {
    logger.info({ ai: event }, 'ai call complete');

    if (!this.cache) return;

    const day = new Date().toISOString().slice(0, 10);
    const sk = `REQ#${ulid()}`;
    await this.cache
      .put(
        { pk: `LOG#${day}`, sk },
        { ...event, recordedAt: new Date().toISOString() },
        30 * 24 * 3600,
      )
      .catch((error: unknown) => {
        logger.warn({ err: errorMessage(error) }, 'telemetry persist failed');
      });
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
