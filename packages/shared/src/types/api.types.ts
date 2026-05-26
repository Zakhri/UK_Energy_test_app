import type { AdviceGoalCode, PreferenceCode, RegionCode } from '../schemas/api.schemas.js';

export interface ApiResponseMeta {
  readonly requestId: string;
  readonly dataAgeSeconds: number;
  readonly degraded: boolean;
  readonly source?: 'fresh' | 'cache' | 'stale';

  readonly aiCacheHit?: boolean;
}

export interface ConfidenceComponentsDto {
  readonly dataFreshness: number;
  readonly contextCoverage: number;
  readonly citations: number;
  readonly schemaValidity: number;
}

export type ConfidenceRecommendationDto =
  | 'use_direct'
  | 'use_with_caveat'
  | 'ask_user'
  | 'fallback_cache';

export interface ConfidenceScoreDto {
  readonly overall: number;
  readonly components: ConfidenceComponentsDto;
  readonly recommendation: ConfidenceRecommendationDto;
  readonly caveats: readonly string[];
}

export interface RecommendationDto {
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly expectedCarbonGCo2: number;
  readonly expectedCostPounds?: number;
  readonly reasoning: string;
  readonly tradeoffs: string;
  readonly priority: number;
}

export interface RecommendationsResponse {
  readonly refused: boolean;
  readonly refusalReason?: string;
  readonly recommendations: readonly RecommendationDto[];
  readonly summary: string;
  readonly caveats: readonly string[];
  readonly citations: readonly string[];
  readonly confidence: ConfidenceScoreDto;
  readonly meta: ApiResponseMeta & {
    readonly modelUsed: string;
    readonly promptVersion: string;
    readonly costUsd: number;
  };
  readonly inputs: {
    readonly goal: AdviceGoalCode;
    readonly region: RegionCode;
    readonly kwh: number;

    readonly deadline?: string;
    readonly preferences: readonly PreferenceCode[];
  };
}

export interface CarbonSignalPoint {
  readonly from: string;
  readonly to: string;
  readonly intensityGCo2PerKwh: number;
  readonly index: string;
  readonly kind: 'forecast' | 'actual';

  readonly unreliable?: boolean;
}

export interface WeatherSignalPoint {
  readonly at: string;
  readonly temperatureCelsius: number;
  readonly cloudCoverPercent: number;
  readonly windSpeedMps: number;
  readonly precipitationMm: number;
}

export interface PriceSignalPoint {
  readonly from: string;
  readonly to: string;
  readonly pricePoundsPerMwh: number;
}

export interface SignalsResponse {
  readonly category: 'carbon' | 'weather' | 'price';
  readonly region: RegionCode;
  readonly source: string;
  readonly updatedAt: string;
  readonly signals:
    | readonly CarbonSignalPoint[]
    | readonly WeatherSignalPoint[]
    | readonly PriceSignalPoint[];
  readonly meta: ApiResponseMeta;
}

export interface CompareResponse {
  readonly refused: boolean;
  readonly refusalReason?: string;
  readonly ranked: ReadonlyArray<{
    readonly scenarioId: string;
    readonly score: number;
    readonly rationale: string;
    readonly expectedCarbonGCo2: number;
    readonly expectedCostPounds?: number;
  }>;
  readonly reasoning: string;
  readonly caveats: readonly string[];
  readonly citations: readonly string[];
  readonly confidence: ConfidenceScoreDto;
  readonly meta: ApiResponseMeta & {
    readonly modelUsed: string;
    readonly promptVersion: string;
    readonly costUsd: number;
  };
}

export interface TrendsSummaryDto {
  readonly todayAvgGCo2: number;
  readonly weekAvgGCo2: number;
  readonly deltaPct: number;
  readonly verdict: 'cleaner' | 'similar' | 'dirtier';
  readonly todayCleanestSlot: { readonly from: string; readonly intensityGCo2PerKwh: number };
  readonly todayDirtiestSlot: { readonly from: string; readonly intensityGCo2PerKwh: number };
  readonly todaySampleSize: number;
  readonly weekSampleSize: number;
  readonly hourlyDelta: ReadonlyArray<number | null>;
}

export interface TrendsInsightResponse {
  readonly refused: boolean;
  readonly refusalReason?: string;

  readonly trends: TrendsSummaryDto | null;
  readonly headline: string;
  readonly explanation: string;
  readonly drivers: readonly string[];
  readonly caveats: readonly string[];
  readonly citations: readonly string[];
  readonly confidence: ConfidenceScoreDto;
  readonly meta: ApiResponseMeta & {
    readonly modelUsed: string;
    readonly promptVersion: string;
    readonly costUsd: number;
  };
  readonly inputs: { readonly region: RegionCode };
}

export interface AiMetricsResponse {
  readonly last24h: {
    readonly totalCalls: number;
    readonly cacheHitRate: number;
    readonly avgLatencyMs: number;
    readonly p95LatencyMs: number;
    readonly totalCostUsd: number;
    readonly avgConfidence: number;
    readonly schemaValidityRate: number;
    readonly refusalRate: number;
    readonly fallbackCount: number;
    readonly degradedCount: number;

    readonly implicitCacheRate: number;

    readonly avgInputTokens: number;
  };
  readonly snapshotAt: string;
}
