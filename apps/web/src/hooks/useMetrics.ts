import { useQuery } from '@tanstack/react-query';
import type { AiMetricsResponse } from '@uk-energy/shared';

import { api } from '../lib/api-client.js';

export const useMetrics = () =>
  useQuery<AiMetricsResponse>({
    queryKey: ['ai-metrics'],
    queryFn: () => api.fetchMetrics(),
    refetchInterval: 30_000,
  });
