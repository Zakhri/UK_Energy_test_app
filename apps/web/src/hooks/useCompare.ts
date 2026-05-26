import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CompareBody, CompareResponse } from '@uk-energy/shared';

import { api, type ApiError } from '../lib/api-client.js';

export const useCompareMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<CompareResponse, ApiError, CompareBody>({
    mutationFn: (body) => api.postCompare(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-metrics'] });
    },
  });
};
