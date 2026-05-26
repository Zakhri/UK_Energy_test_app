import type { UkRegionCode } from './energy.js';

export type AdviceGoal =
  | 'ev-charge'
  | 'heat-pump'
  | 'high-usage-appliance'
  | 'battery-storage'
  | 'general';

export type PreferenceFlag = 'low-carbon' | 'low-price' | 'avoid-peak' | 'fast-completion';

export interface AdviceRequest {
  readonly goal: AdviceGoal;
  readonly region: UkRegionCode;
  readonly kwhRequired: number;
  readonly deadline?: string;
  readonly preferences: readonly PreferenceFlag[];

  readonly note?: string;
}

export interface Recommendation {
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly expectedCarbonGCo2: number;
  readonly expectedCostPounds?: number;
  readonly reasoning: string;
  readonly tradeoffs: string;

  readonly priority: number;
}

export type CitationSource = 'carbon-intensity' | 'open-meteo' | 'entsoe' | 'synthetic-prices';

export interface RecommendationBundle {
  readonly refused: boolean;
  readonly refusalReason?: string;
  readonly recommendations: readonly Recommendation[];
  readonly summary: string;
  readonly caveats: readonly string[];
  readonly citations: readonly CitationSource[];
}

export interface ScenarioInput {
  readonly id: string;
  readonly label: string;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly kwh: number;
}

export interface ScenarioCriteria {
  readonly goal: AdviceGoal;
  readonly weights: {
    readonly carbon: number;
    readonly cost: number;
    readonly speed: number;
  };
}

export interface RankedScenario {
  readonly scenarioId: string;
  readonly score: number;
  readonly rationale: string;
  readonly expectedCarbonGCo2: number;
  readonly expectedCostPounds?: number;
}

export interface CompareResult {
  readonly refused: boolean;
  readonly refusalReason?: string;
  readonly ranked: readonly RankedScenario[];
  readonly reasoning: string;
  readonly caveats: readonly string[];
  readonly citations: readonly CitationSource[];
}
