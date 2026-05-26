import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RecommendationsQuery, RecommendationsResponse } from '@uk-energy/shared';

import { ApiError, api } from '../lib/api-client.js';

const SSE_ENABLED = !import.meta.env.PROD;

export type RecommendationStage =
  | 'idle'
  | 'connecting'
  | 'fetching_data'
  | 'ai_call'
  | 'validating'
  | 'complete';

export interface UseStreamingRecommendationsResult {
  data: RecommendationsResponse | null;
  error: ApiError | null;
  isPending: boolean;

  stage: RecommendationStage;

  trigger: (query: RecommendationsQuery) => void;

  reset: () => void;
}

export function useStreamingRecommendations(): UseStreamingRecommendationsResult {
  const [data, setData] = useState<RecommendationsResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [stage, setStage] = useState<RecommendationStage>('idle');
  const sourceRef = useRef<EventSource | null>(null);
  const queryClient = useQueryClient();

  const closeStream = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  const reset = useCallback(() => {
    closeStream();
    setData(null);
    setError(null);
    setStage('idle');
  }, [closeStream]);

  const trigger = useCallback(
    (query: RecommendationsQuery) => {
      closeStream();
      setData(null);
      setError(null);
      setStage('connecting');

      // SSE only works through direct HTTP (Vite dev proxy → Hono).
      // Production routes through API Gateway REST, which buffers Lambda
      // responses and never flushes chunks, so EventSource hangs forever.
      // Fall back to the regular JSON endpoint with synthetic stage events.
      if (!SSE_ENABLED) {
        setStage('fetching_data');
        api
          .fetchRecommendations(query)
          .then((payload) => {
            setStage('validating');
            setData(payload);
            setStage('complete');
            queryClient.invalidateQueries({ queryKey: ['ai-metrics'] });
          })
          .catch((err: unknown) => {
            if (err instanceof ApiError) setError(err);
            else setError(toApiError(err, 'Recommendations request failed'));
          });
        return;
      }

      const params = new URLSearchParams({
        goal: query.goal,
        region: query.region,
        kwh: String(query.kwh),
        ...(query.deadline ? { deadline: query.deadline } : {}),
        ...(query.preferences && query.preferences.length > 0
          ? { preferences: query.preferences.join(',') }
          : {}),
        ...(query.note ? { note: query.note } : {}),
      });
      const source = new EventSource(`/api/recommendations/stream?${params.toString()}`);
      sourceRef.current = source;

      // Backend `stage` events update the progress indicator.
      source.addEventListener('stage', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as { name: RecommendationStage };
          setStage(payload.name);
        } catch {
          /* malformed event — ignore */
        }
      });

      source.addEventListener('complete', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as RecommendationsResponse;
          setData(payload);
          setStage('complete');
          // Same side-effect as the REST mutation — refresh metrics tile.
          queryClient.invalidateQueries({ queryKey: ['ai-metrics'] });
        } catch (parseError) {
          setError(toApiError(parseError, 'Could not parse SSE complete payload'));
        }
        closeStream();
      });

      source.addEventListener('error', (event) => {
        // Two cases: (a) the server explicitly emitted `event: error` with a
        // problem+json body — try to parse it, (b) the connection dropped
        // before 'complete' fired and we have no payload.
        if ('data' in event && typeof (event as MessageEvent).data === 'string') {
          try {
            const problem = JSON.parse((event as MessageEvent).data) as {
              status?: number;
              title?: string;
              detail?: string;
              type?: string;
            };
            setError(
              new ApiError(problem.status ?? 500, {
                title: problem.title ?? 'Stream error',
                detail: problem.detail ?? 'Backend returned an error event.',
                ...(problem.type ? { type: problem.type } : {}),
              }),
            );
            closeStream();
            return;
          } catch {
            /* fall through to generic */
          }
        }
        // EventSource fires 'error' on auto-reconnect attempts too — only
        // treat as fatal once readyState is CLOSED.
        if (source.readyState === EventSource.CLOSED) {
          setError(
            new ApiError(0, {
              title: 'Stream interrupted',
              detail: 'The recommendation stream was interrupted before completing.',
            }),
          );
          closeStream();
        }
      });
    },
    [closeStream, queryClient],
  );

  // Tidy up if the component unmounts mid-stream.
  useEffect(() => {
    return () => {
      sourceRef.current?.close();
    };
  }, []);

  const isPending = stage !== 'idle' && stage !== 'complete' && error === null;

  return { data, error, isPending, stage, trigger, reset };
}

function toApiError(error: unknown, fallbackTitle: string): ApiError {
  return new ApiError(500, {
    title: fallbackTitle,
    detail: error instanceof Error ? error.message : String(error),
  });
}
