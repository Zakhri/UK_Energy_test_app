import type { RecommendationsResponse } from '@uk-energy/shared';

import type { RecommendationStage } from '../../hooks/useStreamingRecommendations.js';
import { EmptyState } from './EmptyState.js';
import { ErrorState } from './ErrorState.js';
import { LoadingState } from './LoadingState.js';
import { RecommendationContent } from './RecommendationContent.js';
import { RefusedState } from './RefusedState.js';

interface AiInsightsCardProps {
  data: RecommendationsResponse | null;
  loading: boolean;
  error: string | null;

  stage?: RecommendationStage;

  onTryExample?: () => void;
}

export function AiInsightsCard({ data, loading, error, stage, onTryExample }: AiInsightsCardProps) {
  if (loading) return <LoadingState {...(stage ? { stage } : {})} />;
  if (error) return <ErrorState message={error} />;
  if (!data) return <EmptyState {...(onTryExample ? { onTryExample } : {})} />;
  if (data.refused) return <RefusedState data={data} />;
  return <RecommendationContent data={data} />;
}
