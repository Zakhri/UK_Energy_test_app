import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { RegionCode, TrendsInsightResponse } from '@uk-energy/shared';

import { api, type ApiError } from '../lib/api-client.js';

export const useTrendsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<TrendsInsightResponse, ApiError, RegionCode>({
    mutationFn: (region) => api.fetchTrends(region),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-metrics'] });
    },
  });
};
