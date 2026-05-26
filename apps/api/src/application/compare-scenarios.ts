import { type CompareBody, type CompareResponse } from '@uk-energy/shared';

import type { UkRegionCode } from '../domain/energy.js';
import type { AiPipeline, ContextSummary } from '../infra/ai/pipeline.js';
import { buildAdviceContext, type BuildAdviceContextDeps } from './_lib/build-advice-context.js';
import { scoreScenarios } from './_lib/score-scenarios.js';

export interface CompareScenariosDeps extends BuildAdviceContextDeps {
  readonly pipeline: AiPipeline;
}

export async function compareScenarios(
  deps: CompareScenariosDeps,
  body: CompareBody,
  requestId: string,
): Promise<CompareResponse> {
  const region = body.region as UkRegionCode;
  const advice = await buildAdviceContext(deps, region);

  const ranked = scoreScenarios({
    scenarios: body.scenarios,
    criteria: body.criteria,
    carbon: advice.carbon,
    prices: advice.prices,
  });

  const contextSummary: ContextSummary = {
    priceSource: advice.priceSource,
    oldestDataAgeMinutes: advice.oldestDataAgeMinutes,
    unreliableCarbonCount: advice.unreliableCarbonCount,
    contextSourcesPresent: 3,
  };

  const envelope = await deps.pipeline.compareScenarios(
    { region: body.region, criteria: body.criteria },
    ranked,
    contextSummary,
    requestId,
  );

  const rationaleById = new Map(
    envelope.payload.scenarioRationales.map((entry) => [entry.scenarioId, entry.rationale]),
  );
  const mergedRanked = ranked.map((row) => ({
    scenarioId: row.scenarioId,
    score: row.score,
    rationale: rationaleById.get(row.scenarioId)?.trim() || 'Rationale unavailable.',
    expectedCarbonGCo2: row.expectedCarbonGCo2,
    ...(row.expectedCostPounds !== undefined ? { expectedCostPounds: row.expectedCostPounds } : {}),
  }));

  return {
    refused: envelope.payload.refused,
    ...(envelope.payload.refusalReason ? { refusalReason: envelope.payload.refusalReason } : {}),
    ranked: mergedRanked,
    reasoning: envelope.payload.reasoning,
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
  };
}
