import { createHash } from 'node:crypto';

import type { CacheKey, CacheRepository } from '../cache/index.js';
import { floorToBucket } from '../_lib/time.js';

const BUCKET_MINUTES = 15;

export interface AiCacheKeyInput {
  readonly promptVersion: string;
  readonly promptHash: string;
  readonly modelId: string;
  readonly contentJson: string;
}

export function buildAiCacheKey(input: AiCacheKeyInput): CacheKey {
  const bucket = floorToBucket(BUCKET_MINUTES);
  const hashInput = `${input.promptVersion}|${input.promptHash}|${input.modelId}|${input.contentJson}|${bucket}`;
  const digest = createHash('sha256').update(hashInput).digest('hex').slice(0, 32);
  return { pk: `AI#${digest}`, sk: 'V#1' };
}

/** Convenience: read prior cached AI response, returning the parsed payload. */
export async function readAiCache<T>(cache: CacheRepository, key: CacheKey): Promise<T | null> {
  const entry = await cache.get<T>(key);
  return entry?.value ?? null;
}

export async function writeAiCache<T>(
  cache: CacheRepository,
  key: CacheKey,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  await cache.put(key, value, ttlSeconds);
}
