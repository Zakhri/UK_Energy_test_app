import { clamp01, round } from '../_lib/math.js';

export type ConfidenceRecommendation =
  | 'use_direct'
  | 'use_with_caveat'
  | 'ask_user'
  | 'fallback_cache';

export interface ConfidenceComponents {
  readonly dataFreshness: number;
  readonly contextCoverage: number;
  readonly citations: number;
  readonly schemaValidity: number;
}

export interface ConfidenceScore {
  readonly overall: number;
  readonly components: ConfidenceComponents;
  readonly recommendation: ConfidenceRecommendation;
  readonly caveats: readonly string[];
}

export const CONFIDENCE_WEIGHTS = {
  dataFreshness: 0.4,
  contextCoverage: 0.3,
  citations: 0.2,
  schemaValidity: 0.1,
} as const;

export interface ScoreInput {
  readonly dataAgeMinutes: number;

  readonly requiredFieldsPopulated: number;

  readonly requiredFieldsTotal: number;

  readonly citationCount: number;

  readonly schemaValid: boolean;

  readonly externalCaveats?: readonly string[];
}

const FRESHNESS_HORIZON_MINUTES = 60;

export function computeConfidence(input: ScoreInput): ConfidenceScore {
  const dataFreshness = clamp01(1 - input.dataAgeMinutes / FRESHNESS_HORIZON_MINUTES);
  const contextCoverage =
    input.requiredFieldsTotal === 0
      ? 0
      : clamp01(input.requiredFieldsPopulated / input.requiredFieldsTotal);
  const citations = citationScore(input.citationCount);
  const schemaValidity = input.schemaValid ? 1 : 0;

  const overall = clamp01(
    CONFIDENCE_WEIGHTS.dataFreshness * dataFreshness +
      CONFIDENCE_WEIGHTS.contextCoverage * contextCoverage +
      CONFIDENCE_WEIGHTS.citations * citations +
      CONFIDENCE_WEIGHTS.schemaValidity * schemaValidity,
  );

  const caveats = buildCaveats(
    { dataFreshness, contextCoverage, citations, schemaValidity },
    input,
  );

  return {
    overall: round(overall, 2),
    components: {
      dataFreshness: round(dataFreshness, 2),
      contextCoverage: round(contextCoverage, 2),
      citations: round(citations, 2),
      schemaValidity,
    },
    recommendation: recommendationFor(overall),
    caveats,
  };
}

function citationScore(count: number): number {
  if (count === 0) return 0;
  if (count === 1) return 0.5;
  return 1;
}

function recommendationFor(overall: number): ConfidenceRecommendation {
  if (overall >= 0.75) return 'use_direct';
  if (overall >= 0.5) return 'use_with_caveat';
  if (overall >= 0.3) return 'ask_user';
  return 'fallback_cache';
}

function buildCaveats(components: ConfidenceComponents, input: ScoreInput): readonly string[] {
  const caveats: string[] = [...(input.externalCaveats ?? [])];
  if (components.dataFreshness < 0.5) {
    caveats.push(
      `Upstream data is ${Math.round(input.dataAgeMinutes)} minutes old — UK upstream feeds refresh every 30–60 minutes`,
    );
  }
  if (components.contextCoverage < 0.7) {
    caveats.push(
      `Only ${input.requiredFieldsPopulated} of ${input.requiredFieldsTotal} required input fields supplied`,
    );
  }
  if (components.citations < 0.5) {
    caveats.push('Recommendation is not grounded in multiple data sources');
  }
  if (components.schemaValidity === 0) {
    caveats.push('AI output failed schema validation — fallback applied');
  }
  return caveats;
}
