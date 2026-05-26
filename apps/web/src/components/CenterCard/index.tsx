import type { ApiError } from '../../lib/api-client.js';
import type { LastResult } from '../../state/lastResult.js';
import { AiInsightsCard } from '../AiInsightsCard/index.js';
import { CompareResultsPanel } from '../CompareResultsPanel/index.js';
import type { ScenarioRow } from '../CompareScenarios/index.js';
import { TrendsInsightCard } from '../TrendsInsightCard/index.js';
import type { RecommendationStage } from '../../hooks/useStreamingRecommendations.js';
import { CenterCardEmptyState } from './EmptyState.js';

interface CenterCardProps {
  lastResult: LastResult | null;

  pending:
    | { kind: 'recommend'; stage?: RecommendationStage }
    | { kind: 'compare'; scenarios: ScenarioRow[] }
    | { kind: 'trends' }
    | null;

  error:
    | { kind: 'recommend'; message: string }
    | { kind: 'compare'; error: ApiError }
    | { kind: 'trends'; error: ApiError }
    | null;

  onDismissCompareError: () => void;
}

export function CenterCard(props: CenterCardProps) {
  return (
    <div className="h-full [&>section]:h-full [&>section]:min-h-0 [&>section]:!overflow-y-auto scroll-area-quiet">
      <CenterCardInner {...props} />
    </div>
  );
}

function CenterCardInner({ lastResult, pending, error, onDismissCompareError }: CenterCardProps) {
  if (pending?.kind === 'recommend') {
    return (
      <AiInsightsCard
        data={null}
        loading
        error={null}
        {...(pending.stage ? { stage: pending.stage } : {})}
      />
    );
  }
  if (pending?.kind === 'compare') {
    return (
      <CompareResultsPanel
        data={null}
        error={null}
        isPending
        scenarios={pending.scenarios}
        onDismissError={onDismissCompareError}
      />
    );
  }
  if (pending?.kind === 'trends') {
    return <TrendsInsightCard data={null} loading error={null} />;
  }

  if (error?.kind === 'recommend') {
    return <AiInsightsCard data={null} loading={false} error={error.message} />;
  }
  if (error?.kind === 'compare') {
    return (
      <CompareResultsPanel
        data={null}
        error={error.error}
        isPending={false}
        scenarios={[]}
        onDismissError={onDismissCompareError}
      />
    );
  }
  if (error?.kind === 'trends') {
    return <TrendsInsightCard data={null} loading={false} error={error.error} />;
  }

  if (lastResult?.kind === 'recommend') {
    return <AiInsightsCard data={lastResult.data} loading={false} error={null} />;
  }
  if (lastResult?.kind === 'compare') {
    return (
      <CompareResultsPanel
        data={lastResult.data}
        error={null}
        isPending={false}
        scenarios={[...lastResult.scenariosSnapshot]}
        onDismissError={onDismissCompareError}
      />
    );
  }
  if (lastResult?.kind === 'trends') {
    return <TrendsInsightCard data={lastResult.data} loading={false} error={null} />;
  }

  return <CenterCardEmptyState />;
}
