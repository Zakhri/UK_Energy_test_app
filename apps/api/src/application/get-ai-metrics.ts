import type { AiMetricsResponse } from '@uk-energy/shared';

import { round } from '../_lib/math.js';
import { isoDay } from '../infra/_lib/time.js';
import type { CacheRepository } from '../infra/cache/index.js';

interface TelemetryRow {
  readonly latencyMs: number;
  readonly costUsd: number;
  readonly cacheHit: boolean;
  readonly schemaValid: boolean;
  readonly refused: boolean;
  readonly degraded: boolean;
  readonly confidenceOverall: number;
  readonly fallbackUsed?: string;
  readonly promptTokens: number;
  readonly cachedInputTokens: number;
}

export async function getAiMetrics(cache: CacheRepository): Promise<AiMetricsResponse> {
  const rows = await collectRecentTelemetryRows(cache);
  if (rows.length === 0) {
    return emptyMetrics();
  }

  const totalCalls = rows.length;
  const cacheHits = rows.filter((row) => row.cacheHit).length;
  const refused = rows.filter((row) => row.refused).length;
  const schemaValid = rows.filter((row) => row.schemaValid).length;
  const fallback = rows.filter((row) => row.fallbackUsed !== undefined).length;
  const degraded = rows.filter((row) => row.degraded).length;
  const latencies = rows.map((row) => row.latencyMs).sort((a, b) => a - b);
  const totalCost = rows.reduce((sum, row) => sum + row.costUsd, 0);
  const avgLatency = latencies.reduce((sum, value) => sum + value, 0) / totalCalls;
  const p95Latency = latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))];
  const avgConfidence = rows.reduce((sum, row) => sum + row.confidenceOverall, 0) / totalCalls;

  const totalPromptTokens = rows.reduce((sum, row) => sum + row.promptTokens, 0);
  const totalCachedTokens = rows.reduce((sum, row) => sum + row.cachedInputTokens, 0);
  const implicitCacheRate = totalPromptTokens === 0 ? 0 : totalCachedTokens / totalPromptTokens;
  const avgInputTokens = Math.round(totalPromptTokens / totalCalls);

  return {
    last24h: {
      totalCalls,
      cacheHitRate: round(cacheHits / totalCalls, 3),
      avgLatencyMs: Math.round(avgLatency),
      p95LatencyMs: Math.round(p95Latency ?? avgLatency),
      totalCostUsd: round(totalCost, 6),
      avgConfidence: round(avgConfidence, 2),
      schemaValidityRate: round(schemaValid / totalCalls, 3),
      refusalRate: round(refused / totalCalls, 3),
      fallbackCount: fallback,
      degradedCount: degraded,
      implicitCacheRate: round(implicitCacheRate, 3),
      avgInputTokens,
    },
    snapshotAt: new Date().toISOString(),
  };
}

async function collectRecentTelemetryRows(cache: CacheRepository): Promise<TelemetryRow[]> {
  const today = isoDay();
  const yesterday = isoDay(new Date(Date.now() - 24 * 3600 * 1000));

  const [todays, yesterdays] = await Promise.all([
    cache.iterate<Partial<TelemetryRow>>(`LOG#${today}`),
    cache.iterate<Partial<TelemetryRow>>(`LOG#${yesterday}`),
  ]);

  return [...todays, ...yesterdays].map((entry) => ({
    latencyMs: entry.value.latencyMs ?? 0,
    costUsd: entry.value.costUsd ?? 0,
    cacheHit: entry.value.cacheHit ?? false,
    schemaValid: entry.value.schemaValid ?? true,
    refused: entry.value.refused ?? false,
    degraded: entry.value.degraded ?? false,
    confidenceOverall: entry.value.confidenceOverall ?? 0,
    promptTokens: entry.value.promptTokens ?? 0,
    cachedInputTokens: entry.value.cachedInputTokens ?? 0,
    ...(entry.value.fallbackUsed ? { fallbackUsed: entry.value.fallbackUsed } : {}),
  }));
}

function emptyMetrics(): AiMetricsResponse {
  return {
    last24h: {
      totalCalls: 0,
      cacheHitRate: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      totalCostUsd: 0,
      avgConfidence: 0,
      schemaValidityRate: 0,
      refusalRate: 0,
      fallbackCount: 0,
      degradedCount: 0,
      implicitCacheRate: 0,
      avgInputTokens: 0,
    },
    snapshotAt: new Date().toISOString(),
  };
}
