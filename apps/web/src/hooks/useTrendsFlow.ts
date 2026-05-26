import { useCallback, useEffect, useRef, useState } from 'react';
import type { RegionCode } from '@uk-energy/shared';

import type { ApiError } from '../lib/api-client.js';
import { newResultId, type TrendsResult } from '../state/lastResult.js';
import { useTrendsMutation } from './useTrends.js';

export interface UseTrendsFlowOptions {
  readonly onResult: (result: TrendsResult) => void;
  readonly autoLoadRegion?: RegionCode;
}

export interface UseTrendsFlowResult {
  readonly run: (region: RegionCode) => void;
  readonly error: ApiError | null;
  readonly isPending: boolean;
}

export function useTrendsFlow({
  onResult,
  autoLoadRegion,
}: UseTrendsFlowOptions): UseTrendsFlowResult {
  const { mutate, data, error, isPending } = useTrendsMutation();
  const [lastQuery, setLastQuery] = useState<{ region: RegionCode } | null>(null);

  useEffect(() => {
    if (!data || data.refused || !lastQuery) return;
    onResult({
      kind: 'trends',
      id: newResultId(),
      recordedAt: new Date().toISOString(),
      query: lastQuery,
      data,
    });
  }, [data, lastQuery, onResult]);

  const run = useCallback(
    (region: RegionCode) => {
      setLastQuery({ region });
      mutate(region);
    },
    [mutate],
  );

  const didAutoLoadRef = useRef(false);
  useEffect(() => {
    if (didAutoLoadRef.current || !autoLoadRegion) return;
    didAutoLoadRef.current = true;
    run(autoLoadRegion);
  }, [autoLoadRegion, run]);

  return { run, error: error ?? null, isPending };
}
