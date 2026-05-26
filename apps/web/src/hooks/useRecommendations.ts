import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { RecommendationsQuery, RecommendationsResponse } from '@uk-energy/shared';

import { api, type ApiError } from '../lib/api-client.js';

export const useRecommendationsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<RecommendationsResponse, ApiError, RecommendationsQuery>({
    mutationFn: (query) => api.fetchRecommendations(query),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-metrics'] });
    },
  });
};
