import type {
  CompareBody,
  CompareResponse,
  RecommendationsQuery,
  RecommendationsResponse,
  RegionCode,
  TrendsInsightResponse,
} from '@uk-energy/shared';

import type { ScenarioRow } from '../components/CompareScenarios/index.js';

export type ResultKind = 'recommend' | 'compare' | 'trends';

interface BaseResult {
  readonly id: string;
  readonly recordedAt: string;
}

export interface RecommendResult extends BaseResult {
  readonly kind: 'recommend';
  readonly query: RecommendationsQuery;
  readonly data: RecommendationsResponse;
}

export interface CompareResult extends BaseResult {
  readonly kind: 'compare';
  readonly query: CompareBody;
  readonly scenariosSnapshot: readonly ScenarioRow[];
  readonly data: CompareResponse;
}

export interface TrendsResult extends BaseResult {
  readonly kind: 'trends';
  readonly query: { readonly region: RegionCode };
  readonly data: TrendsInsightResponse;
}

export type LastResult = RecommendResult | CompareResult | TrendsResult;

export function newResultId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
