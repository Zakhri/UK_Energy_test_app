import { useCallback, useState } from 'react';
import type { CompareBody, RegionCode } from '@uk-energy/shared';

import { AiMetricsPanel } from './components/AiMetricsPanel/index.js';
import { CenterCard } from './components/CenterCard/index.js';
import { CompareScenarios } from './components/CompareScenarios/index.js';
import { refreshScenarioDates } from './components/CompareScenarios/_lib/refreshScenarioDates.js';
import { toIso } from './components/CompareScenarios/_lib/toIso.js';
import { DashboardHeader } from './components/DashboardHeader/index.js';
import { RecentRecommendations } from './components/RecentRecommendations/index.js';
import { ScenarioForm, type ScenarioFormValues } from './components/ScenarioForm/index.js';
import { SimulatedImpactChart } from './components/SimulatedImpactChart/index.js';
import { useChartHighlight } from './hooks/useChartHighlight.js';
import { useCompareFlow } from './hooks/useCompareFlow.js';
import { useDebugMode } from './hooks/useDebugMode.js';
import { useRecent } from './hooks/useRecent.js';
import { useRecommendationFlow } from './hooks/useRecommendationFlow.js';
import { useTrendsFlow } from './hooks/useTrendsFlow.js';
import { type LastResult } from './state/lastResult.js';
import { toStoredEntry, type StoredEntry } from './state/storage.js';
import { MotionPanel } from './ui/MotionPanel.js';

export function App() {
  const [region, setRegion] = useState<RegionCode>('GB-LON');
  const [projectedKwh, setProjectedKwh] = useState(30);
  const debugMode = useDebugMode();

  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const recent = useRecent();

  const handleResult = useCallback(
    (result: LastResult) => {
      setLastResult(result);
      recent.add(toStoredEntry(result));
    },
    [recent],
  );

  const recommendation = useRecommendationFlow({ onResult: handleResult });
  const compare = useCompareFlow({ onResult: handleResult });
  const trends = useTrendsFlow({ onResult: handleResult, autoLoadRegion: region });

  const pending = recommendation.isPending
    ? ({
        kind: 'recommend',
        ...(recommendation.stage ? { stage: recommendation.stage } : {}),
      } as const)
    : compare.isPending
      ? ({ kind: 'compare', scenarios: compare.submittedScenarios } as const)
      : trends.isPending
        ? ({ kind: 'trends' } as const)
        : null;

  const error = recommendation.error
    ? ({ kind: 'recommend', message: recommendation.error.message } as const)
    : compare.error
      ? ({ kind: 'compare', error: compare.error } as const)
      : trends.error
        ? ({ kind: 'trends', error: trends.error } as const)
        : null;

  const chartHighlight = useChartHighlight(lastResult);

  const handleRecommendationSubmit = (values: ScenarioFormValues) => {
    setProjectedKwh(values.kwh);
    recommendation.run({
      goal: values.goal,
      region,
      kwh: values.kwh,
      ...(values.deadline ? { deadline: values.deadline } : {}),
      preferences: values.preferences,
    });
  };

  const handleCompareSubmit = (body: CompareBody) => {
    compare.run(body, compare.scenarios);
  };

  const handleTrendsTrigger = () => trends.run(region);

  const handleRerunRecent = (entry: StoredEntry) => {
    if (entry.kind === 'recommend') {
      setRegion(entry.query.region as RegionCode);
      setProjectedKwh(entry.query.kwh);
      recommendation.run(entry.query);
    } else if (entry.kind === 'compare') {
      setRegion(entry.query.region as RegionCode);
      const refreshed = refreshScenarioDates(entry.scenariosSnapshot);
      const refreshedBody: CompareBody = {
        ...entry.query,
        scenarios: refreshed.map((row) => ({
          id: row.id,
          label: row.label,
          windowStart: toIso(row.windowStart),
          windowEnd: toIso(row.windowEnd),
          kwh: row.kwh,
        })),
      };
      compare.setScenarios(refreshed);
      compare.setWeights(entry.query.criteria.weights);
      compare.run(refreshedBody, refreshed);
    } else {
      setRegion(entry.query.region);
      trends.run(entry.query.region);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-page p-3 sm:p-4">
      <div className="flex h-full flex-col rounded-3xl border border-slate-200/70 bg-white shadow-soft">
        <DashboardHeader
          region={region}
          onRegionChange={setRegion}
          onTrendsClick={handleTrendsTrigger}
          trendsLoading={trends.isPending}
        />

        <main className="grid min-h-0 flex-1 gap-4 overflow-hidden px-4 pb-4 lg:grid-cols-12">
          <div className="flex min-h-0 flex-col gap-4 overflow-hidden lg:col-span-3">
            <MotionPanel index={0} className="shrink-0">
              <ScenarioForm
                region={region}
                submitting={recommendation.isPending}
                onSubmit={handleRecommendationSubmit}
              />
            </MotionPanel>
            <MotionPanel index={4} className="flex-1 min-h-0">
              <RecentRecommendations
                entries={recent.entries}
                activeId={lastResult?.id ?? null}
                onRerun={handleRerunRecent}
                onCleared={recent.clear}
              />
            </MotionPanel>
            {debugMode ? (
              <MotionPanel index={5} className="shrink-0">
                <AiMetricsPanel compact />
              </MotionPanel>
            ) : null}
          </div>

          <div className="flex min-h-0 flex-col gap-4 lg:col-span-6">
            <div className="flex-1 min-h-0">
              <MotionPanel index={2} className="h-full">
                <CenterCard
                  lastResult={lastResult}
                  pending={pending}
                  error={error}
                  onDismissCompareError={compare.resetError}
                />
              </MotionPanel>
            </div>

            <MotionPanel index={5} className="shrink-0">
              <SimulatedImpactChart region={region} kwh={projectedKwh} highlight={chartHighlight} />
            </MotionPanel>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden lg:col-span-3">
            <MotionPanel index={1} className="flex-1 min-h-0">
              <CompareScenarios
                region={region}
                scenarios={compare.scenarios}
                onScenariosChange={compare.setScenarios}
                weights={compare.weights}
                onWeightsChange={compare.setWeights}
                onSubmit={handleCompareSubmit}
                isPending={compare.isPending}
              />
            </MotionPanel>
          </div>
        </main>

        <footer className="shrink-0 border-t border-slate-100 px-6 py-2 text-[11px] text-slate-500">
          <div className="flex items-center justify-between">
            <span>UK Energy Insights · Gemini 3.1 Flash-Lite (free tier)</span>
            <span className="font-mono text-slate-400">v0.1.0</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
