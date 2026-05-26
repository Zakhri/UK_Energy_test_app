import { useQuery } from '@tanstack/react-query';
import type { RegionCode, SignalsResponse } from '@uk-energy/shared';

import { api } from '../lib/api-client.js';

export const useSignals = (category: 'carbon' | 'weather' | 'price', region: RegionCode) =>
  useQuery<SignalsResponse>({
    queryKey: ['signals', category, region],
    queryFn: () => api.fetchSignals(category, region),
    staleTime: category === 'carbon' ? 5 * 60 * 1000 : 15 * 60 * 1000,
  });
