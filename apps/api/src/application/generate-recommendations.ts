import type {
  RecommendationDto,
  RecommendationsQuery,
  RecommendationsResponse,
} from '@uk-energy/shared';

import type { AdviceRequest } from '../domain/advice.js';
import type { UkRegionCode } from '../domain/energy.js';
import type { OptimalWindow } from '../domain/optimal-window.js';
import type { AiPipeline, ContextSummary } from '../infra/ai/pipeline.js';
import type { RecommendationBundleParsed } from '../schemas/ai-response.js';
import { buildAdviceContext, type BuildAdviceContextDeps } from './_lib/build-advice-context.js';
import { findOptimalWindows } from './_lib/find-optimal-windows.js';

const RECOMMENDATION_DURATION_DEFAULT_HOURS = 6;

export type RecommendationStage =
  | 'fetching_data'
  | 'optimising'
  | 'ai_call'
  | 'validating'
  | 'complete';

export interface GenerateRecommendationsDeps extends BuildAdviceContextDeps {
  readonly pipeline: AiPipeline;
}

export interface GenerateOptions {
  readonly onStage?: (stage: RecommendationStage) => void | Promise<void>;
}

export async function generateRecommendations(
  deps: GenerateRecommendationsDeps,
  query: RecommendationsQuery,
  requestId: string,
  options: GenerateOptions = {},
): Promise<RecommendationsResponse> {
  const emit = async (stage: RecommendationStage): Promise<void> => {
    if (options.onStage) await options.onStage(stage);
  };

  const adviceRequest: AdviceRequest = {
    goal: query.goal,
    region: query.region as UkRegionCode,
    kwhRequired: query.kwh,
    ...(query.deadline ? { deadline: query.deadline } : {}),
    preferences: query.preferences ?? [],
    ...(query.note ? { note: query.note } : {}),
  };

  await emit('fetching_data');
  const advice = await buildAdviceContext(deps, adviceRequest.region);

  await emit('optimising');
  const optimalWindows = findOptimalWindows({
    carbon: advice.carbon,
    prices: advice.prices,
    preferences: adviceRequest.preferences,
    durationHours: RECOMMENDATION_DURATION_DEFAULT_HOURS,
    ...(adviceRequest.deadline ? { deadline: adviceRequest.deadline } : {}),
  });

  if (optimalWindows.length === 0) {
    return buildEmptyResponse(query, advice);
  }

  const contextSummary: ContextSummary = {
    priceSource: advice.priceSource,
    oldestDataAgeMinutes: advice.oldestDataAgeMinutes,
    unreliableCarbonCount: advice.unreliableCarbonCount,
    contextSourcesPresent: 3,
  };

  await emit('ai_call');
  const envelope = await deps.pipeline.generateRecommendations(
    adviceRequest,
    optimalWindows,
    contextSummary,
    requestId,
  );

  await emit('validating');

  const recommendations = mergeWindowsWithNarrative(optimalWindows, envelope.payload);

  return {
    refused: envelope.payload.refused,
    ...(envelope.payload.refusalReason ? { refusalReason: envelope.payload.refusalReason } : {}),
    recommendations,
    summary: envelope.payload.summary,
    caveats: envelope.payload.caveats,
    citations: envelope.payload.citations,
    confidence: envelope.confidence,
    meta: {
      requestId: envelope.meta.requestId,
      dataAgeSeconds: Math.round(advice.oldestDataAgeMinutes * 60),
      degraded: envelope.meta.degraded || advice.priceSource === 'synthetic',
      modelUsed: envelope.meta.modelUsed,
      promptVersion: envelope.meta.promptVersion,
      costUsd: envelope.meta.costUsd,
      aiCacheHit: envelope.meta.cacheHit,
    },
    inputs: {
      goal: query.goal,
      region: query.region,
      kwh: query.kwh,
      ...(query.deadline ? { deadline: query.deadline } : {}),
      preferences: query.preferences ?? [],
    },
  };
}

function mergeWindowsWithNarrative(
  windows: readonly OptimalWindow[],
  ai: RecommendationBundleParsed,
): RecommendationDto[] {
  const narrativeById = new Map(ai.windowNarratives.map((entry) => [entry.id, entry]));

  return windows.map((window) => {
    const narrative = narrativeById.get(window.id);
    return {
      windowStart: window.windowStart,
      windowEnd: window.windowEnd,
      expectedCarbonGCo2: window.avgCarbonGCo2,
      ...(window.avgCostPounds !== undefined ? { expectedCostPounds: window.avgCostPounds } : {}),
      reasoning: narrative?.reasoning?.trim() || 'Narrative unavailable for this window.',
      tradeoffs: narrative?.tradeoffs?.trim() || '',
      priority: window.priority,
    };
  });
}

function buildEmptyResponse(
  query: RecommendationsQuery,
  advice: {
    readonly priceSource: 'entsoe' | 'synthetic';
    readonly oldestDataAgeMinutes: number;
    readonly unreliableCarbonCount: number;
  },
): RecommendationsResponse {
  const caveats = [
    'No charging window fit your deadline and duration constraints in the current forecast.',
  ];
  if (advice.unreliableCarbonCount > 0) {
    caveats.push(
      `Some forecast readings were excluded as physically implausible (${advice.unreliableCarbonCount} of them).`,
    );
  }

  return {
    refused: false,
    recommendations: [],
    summary: 'No viable charging window was found before your deadline.',
    caveats,
    citations: ['carbon-intensity'],
    confidence: {
      overall: 0.3,
      components: { dataFreshness: 0.5, contextCoverage: 1, citations: 0.5, schemaValidity: 1 },
      recommendation: 'fallback_cache',
      caveats: ['No viable window'],
    },
    meta: {
      requestId: '',
      dataAgeSeconds: Math.round(advice.oldestDataAgeMinutes * 60),
      degraded: advice.priceSource === 'synthetic',
      modelUsed: 'optimizer-only',
      promptVersion: 'n/a',
      costUsd: 0,
      aiCacheHit: false,
    },
    inputs: {
      goal: query.goal,
      region: query.region,
      kwh: query.kwh,
      ...(query.deadline ? { deadline: query.deadline } : {}),
      preferences: query.preferences ?? [],
    },
  };
}
