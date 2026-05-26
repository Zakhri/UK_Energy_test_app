import { ProgressStages } from '@/ui/ProgressStages';
import { Wand2 } from 'lucide-react';

import type { RecommendationStage } from '../../hooks/useStreamingRecommendations.js';

interface LoadingStateProps {
  readonly stage?: RecommendationStage;
}

const STAGE_LABELS = [
  'Fetching live grid data…',
  'Asking Gemini…',
  'Validating recommendations…',
  'Drafting your view…',
] as const;

function stageToIndex(stage: RecommendationStage | undefined): number | undefined {
  if (!stage) return undefined;
  switch (stage) {
    case 'idle':
    case 'connecting':
    case 'fetching_data':
      return 0;
    case 'ai_call':
      return 1;
    case 'validating':
      return 2;
    case 'complete':
      return 3;
  }
}

export function LoadingState({ stage }: LoadingStateProps) {
  const controlledIndex = stageToIndex(stage);
  return (
    <section className="panel">
      <div className="panel-heading">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Wand2 className="h-4 w-4 animate-soft-bounce" />
          </div>
          <div>
            <h2 className="panel-title">Working on it</h2>
            <p className="panel-subtitle">Checking the grid forecast against your plan</p>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200/70 bg-surface-muted/40 p-4">
        <ProgressStages
          stages={STAGE_LABELS}
          {...(controlledIndex !== undefined ? { controlledIndex } : {})}
        />
      </div>
    </section>
  );
}
