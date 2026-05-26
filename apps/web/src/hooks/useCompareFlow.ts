import { useCallback, useEffect, useRef, useState } from 'react';
import type { CompareBody } from '@uk-energy/shared';

import {
  DEFAULT_WEIGHTS,
  buildStarterScenarios,
  type CriteriaWeights,
  type ScenarioRow,
} from '../components/CompareScenarios/index.js';
import type { ApiError } from '../lib/api-client.js';
import { newResultId, type CompareResult } from '../state/lastResult.js';
import { useCompareMutation } from './useCompare.js';

export interface UseCompareFlowOptions {
  readonly onResult: (result: CompareResult) => void;
}

export interface UseCompareFlowResult {
  readonly run: (body: CompareBody, scenarios: readonly ScenarioRow[]) => void;
  readonly resetError: () => void;
  readonly error: ApiError | null;
  readonly isPending: boolean;
  readonly scenarios: ScenarioRow[];
  readonly setScenarios: (scenarios: ScenarioRow[]) => void;
  readonly weights: CriteriaWeights;
  readonly setWeights: (weights: CriteriaWeights) => void;
  readonly submittedScenarios: ScenarioRow[];
}

export function useCompareFlow({ onResult }: UseCompareFlowOptions): UseCompareFlowResult {
  const { mutate, data, error, isPending, reset } = useCompareMutation();
  const [lastQuery, setLastQuery] = useState<CompareBody | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioRow[]>(() => buildStarterScenarios());
  const [weights, setWeights] = useState<CriteriaWeights>(DEFAULT_WEIGHTS);
  const [submittedScenarios, setSubmittedScenarios] = useState<ScenarioRow[]>([]);
  const liftedDataRef = useRef<typeof data | null>(null);

  useEffect(() => {
    if (!data || data.refused || !lastQuery) return;
    if (liftedDataRef.current === data) return;
    liftedDataRef.current = data;
    onResult({
      kind: 'compare',
      id: newResultId(),
      recordedAt: new Date().toISOString(),
      query: lastQuery,
      scenariosSnapshot: submittedScenarios,
      data,
    });
  }, [data, lastQuery, submittedScenarios, onResult]);

  const run = useCallback(
    (body: CompareBody, snapshot: readonly ScenarioRow[]) => {
      setLastQuery(body);
      setSubmittedScenarios([...snapshot]);
      mutate(body);
    },
    [mutate],
  );

  return {
    run,
    resetError: reset,
    error: error ?? null,
    isPending,
    scenarios,
    setScenarios,
    weights,
    setWeights,
    submittedScenarios,
  };
}
