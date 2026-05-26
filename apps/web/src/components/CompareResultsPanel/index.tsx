import { X } from 'lucide-react';
import type { CompareResponse } from '@uk-energy/shared';

import type { ApiError } from '../../lib/api-client.js';
import type { ScenarioRow } from '../CompareScenarios/index.js';
import { computeRangeContext } from './_lib/computeBreakdown.js';
import { PanelHeading } from './PanelHeading.js';
import { RankedRowItem } from './RankedRowItem.js';
import { ProgressStages } from '@/ui/ProgressStages.js';

interface CompareResultsPanelProps {
  data: CompareResponse | null | undefined;
  error: ApiError | null;
  isPending: boolean;

  scenarios: ScenarioRow[];
  onDismissError: () => void;
}

export function CompareResultsPanel({
  data,
  error,
  isPending,
  scenarios,
  onDismissError,
}: CompareResultsPanelProps) {
  if (isPending) {
    return (
      <section className="panel transition-shadow hover:shadow-lift">
        <PanelHeading />
        <div className="rounded-2xl border border-slate-200/70 bg-surface-muted/40 p-4">
          <ProgressStages
            stages={[
              'Fetching grid data for window…',
              'Scoring carbon vs cost…',
              'Ranking your candidates…',
            ]}
          />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel border-red-200 bg-red-50/30">
        <PanelHeading />
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/40 px-3 py-3 text-xs text-red-800">
          <span className="flex-1">{error.message}</span>
          <button
            type="button"
            onClick={onDismissError}
            className="rounded-md p-1 text-red-500 transition hover:bg-red-100 hover:text-red-700"
            aria-label="Dismiss error"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>
    );
  }

  if (!data) return null;

  if (data.refused) {
    return (
      <section className="panel border-amber-200 bg-amber-50/30">
        <PanelHeading />
        <p className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-3 text-xs text-amber-900">
          {data.refusalReason ?? "That's outside what we can help with."}
        </p>
      </section>
    );
  }

  const sorted = [...data.ranked].sort((a, b) => b.score - a.score);

  const rangeContext = computeRangeContext(sorted);
  return (
    <section className="panel transition-shadow hover:shadow-lift">
      <PanelHeading />
      <ul className="space-y-2.5">
        {sorted.map((row, index) => (
          <RankedRowItem
            key={row.scenarioId}
            ranking={row}
            index={index}
            scenario={scenarios.find((entry) => entry.id === row.scenarioId)}
            rangeContext={rangeContext}
          />
        ))}
      </ul>
      {data.reasoning ? (
        <p className="mt-3 rounded-xl bg-surface-muted/60 px-3 py-2.5 text-[12px] leading-relaxed text-slate-700">
          {data.reasoning}
        </p>
      ) : null}
    </section>
  );
}
