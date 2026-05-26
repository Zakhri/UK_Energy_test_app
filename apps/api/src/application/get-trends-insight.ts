import type { RegionCode, TrendsInsightResponse } from '@uk-energy/shared';

import type { CarbonForecast, UkRegionCode, WeatherForecast } from '../domain/energy.js';
import type { CacheRepository } from '../infra/cache/index.js';
import { withCache } from '../infra/cache/index.js';
import type { AiPipeline, ContextSummary } from '../infra/ai/pipeline.js';
import type { CarbonIntensityClient } from '../infra/clients/carbon-intensity.client.js';
import type { OpenMeteoClient } from '../infra/clients/open-meteo.client.js';
import { computeTrends } from './_lib/compute-trends.js';

const HISTORY_DAYS = 7;
const NO_TRENDS_REASON = 'Not enough recent data to compare today against the past week.';

const CARBON_TODAY_TTL_SECONDS = 30 * 60;
const CARBON_TODAY_STALE_SECONDS = 6 * 3600;
const CARBON_HISTORY_TTL_SECONDS = 6 * 3600;
const CARBON_HISTORY_STALE_SECONDS = 24 * 3600;
const WEATHER_TTL_SECONDS = 60 * 60;
const WEATHER_STALE_SECONDS = 12 * 3600;

export interface GetTrendsInsightDeps {
  readonly cache: CacheRepository;
  readonly carbonClient: CarbonIntensityClient;
  readonly weatherClient: OpenMeteoClient;
  readonly pipeline: AiPipeline;
}

export async function getTrendsInsight(
  deps: GetTrendsInsightDeps,
  region: RegionCode,
  requestId: string,
): Promise<TrendsInsightResponse> {
  const ukRegion = region as UkRegionCode;

  const now = new Date();
  const toIso = new Date(Math.floor(now.getTime() / (30 * 60_000)) * 30 * 60_000).toISOString();
  const fromIso = new Date(Date.parse(toIso) - HISTORY_DAYS * 24 * 60 * 60_000).toISOString();

  const historyBucket = toIso.slice(0, 13);
  const [todayResult, historyResult, weatherResult] = await Promise.all([
    withCache<CarbonForecast>(
      deps.cache,
      { pk: `SRC#carbon-intensity#${ukRegion}`, sk: 'fw48h' },
      async () => deps.carbonClient.fetch24hForecast(ukRegion),
      { ttlSeconds: CARBON_TODAY_TTL_SECONDS, maxStaleSeconds: CARBON_TODAY_STALE_SECONDS },
    ),
    withCache<CarbonForecast>(
      deps.cache,
      { pk: `SRC#carbon-intensity#${ukRegion}#history`, sk: historyBucket },
      async () => deps.carbonClient.fetchHistorical(ukRegion, fromIso, toIso),
      { ttlSeconds: CARBON_HISTORY_TTL_SECONDS, maxStaleSeconds: CARBON_HISTORY_STALE_SECONDS },
    ),
    withCache<WeatherForecast>(
      deps.cache,
      { pk: `SRC#open-meteo#${ukRegion}`, sk: 'fw48h' },
      async () => deps.weatherClient.fetch48hForecast(ukRegion),
      { ttlSeconds: WEATHER_TTL_SECONDS, maxStaleSeconds: WEATHER_STALE_SECONDS },
    ),
  ]);

  const today = todayResult.value;
  const history = historyResult.value;
  const weather = weatherResult.value;

  const trends = computeTrends(today.readings, history.readings);

  const todaySnapshots = weather.snapshots.slice(0, 24);
  const todayAvgWindMps =
    todaySnapshots.length > 0 ? round(mean(todaySnapshots.map((s) => s.windSpeedMps)), 1) : 0;
  const todayAvgTempC =
    todaySnapshots.length > 0 ? round(mean(todaySnapshots.map((s) => s.temperatureCelsius)), 1) : 0;

  const oldestFetchedAt = Math.min(
    Date.parse(today.fetchedAt),
    Date.parse(history.fetchedAt),
    Date.parse(weather.fetchedAt),
  );
  const oldestDataAgeMinutes = Math.max(0, (Date.now() - oldestFetchedAt) / 60_000);
  const unreliableCarbonCount = today.readings.filter((r) => r.unreliable).length;

  if (!trends) {
    return buildNullResponse(region, requestId, oldestDataAgeMinutes, unreliableCarbonCount);
  }

  const summary: ContextSummary = {
    priceSource: 'entsoe',
    oldestDataAgeMinutes,
    unreliableCarbonCount,
    contextSourcesPresent: 2,
  };

  const envelope = await deps.pipeline.generateTrendsInsight(
    region,
    trends,
    { todayAvgWindMps, todayAvgTempC },
    summary,
    requestId,
  );

  return {
    refused: envelope.payload.refused,
    ...(envelope.payload.refusalReason ? { refusalReason: envelope.payload.refusalReason } : {}),
    trends,
    headline: envelope.payload.headline,
    explanation: envelope.payload.explanation,
    drivers: envelope.payload.drivers,
    caveats: envelope.payload.caveats,
    citations: envelope.payload.citations,
    confidence: envelope.confidence,
    meta: {
      requestId: envelope.meta.requestId,
      dataAgeSeconds: Math.round(oldestDataAgeMinutes * 60),
      degraded: envelope.meta.degraded,
      modelUsed: envelope.meta.modelUsed,
      promptVersion: envelope.meta.promptVersion,
      costUsd: envelope.meta.costUsd,
      aiCacheHit: envelope.meta.cacheHit,
    },
    inputs: { region },
  };
}

function buildNullResponse(
  region: RegionCode,
  requestId: string,
  oldestDataAgeMinutes: number,
  unreliableCarbonCount: number,
): TrendsInsightResponse {
  return {
    refused: false,
    trends: null,
    headline: NO_TRENDS_REASON,
    explanation:
      "We couldn't pull a clean 7-day history for this region — likely an upstream gap. Try again in a few minutes.",
    drivers: [],
    caveats: [
      ...(unreliableCarbonCount > 0
        ? [
            `${unreliableCarbonCount} forecast reading${
              unreliableCarbonCount === 1 ? ' was' : 's were'
            } excluded as physically implausible.`,
          ]
        : []),
    ],
    citations: ['carbon-intensity'],
    confidence: {
      overall: 0.3,
      components: { dataFreshness: 0.5, contextCoverage: 0.5, citations: 0.5, schemaValidity: 1 },
      recommendation: 'fallback_cache',
      caveats: ['Insufficient history'],
    },
    meta: {
      requestId,
      dataAgeSeconds: Math.round(oldestDataAgeMinutes * 60),
      degraded: true,
      modelUsed: 'optimizer-only',
      promptVersion: 'n/a',
      costUsd: 0,
      aiCacheHit: false,
    },
    inputs: { region },
  };
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
