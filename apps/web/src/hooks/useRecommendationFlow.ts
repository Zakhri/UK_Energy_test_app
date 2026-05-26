import { useCallback, useEffect, useState } from 'react';
import type { RecommendationsQuery } from '@uk-energy/shared';

import { newResultId, type RecommendResult } from '../state/lastResult.js';
import {
  useStreamingRecommendations,
  type RecommendationStage,
} from './useStreamingRecommendations.js';

export interface UseRecommendationFlowOptions {
  readonly onResult: (result: RecommendResult) => void;
}

export interface UseRecommendationFlowResult {
  readonly run: (query: RecommendationsQuery) => void;
  readonly error: Error | null;
  readonly isPending: boolean;
  readonly stage?: RecommendationStage;
}

export function useRecommendationFlow({
  onResult,
}: UseRecommendationFlowOptions): UseRecommendationFlowResult {
  const { trigger, data, error, isPending, stage } = useStreamingRecommendations();
  const [lastQuery, setLastQuery] = useState<RecommendationsQuery | null>(null);

  useEffect(() => {
    if (!data || data.refused || !lastQuery) return;
    onResult({
      kind: 'recommend',
      id: newResultId(),
      recordedAt: new Date().toISOString(),
      query: lastQuery,
      data,
    });
  }, [data, lastQuery, onResult]);

  const run = useCallback(
    (query: RecommendationsQuery) => {
      setLastQuery(query);
      trigger(query);
    },
    [trigger],
  );

  return { run, error, isPending, ...(stage ? { stage } : {}) };
}
