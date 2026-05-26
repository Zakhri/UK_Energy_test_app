import { useEffect, useMemo, useRef, useState } from 'react';
import type { CompareBody, RecommendationsQuery, RegionCode } from '@uk-energy/shared';

import { AiMetricsPanel } from './components/AiMetricsPanel/index.js';
import { CenterCard } from './components/CenterCard/index.js';
import {
  CompareScenarios,
  DEFAULT_WEIGHTS,
  buildStarterScenarios,
  type CriteriaWeights,
  type ScenarioRow,
} from './components/CompareScenarios/index.js';
import { DashboardHeader } from './components/DashboardHeader/index.js';
import { ScenarioForm, type ScenarioFormValues } from './components/ScenarioForm/index.js';
import { SimulatedImpactChart } from './components/SimulatedImpactChart/index.js';
import type { HighlightSpec } from './components/SimulatedImpactChart/_lib/highlightSpec.js';
import { useCompareMutation } from './hooks/useCompare.js';
import { useStreamingRecommendations } from './hooks/useStreamingRecommendations.js';
import { useTrendsMutation } from './hooks/useTrends.js';
import { newResultId, type LastResult } from './state/lastResult.js';
import { MotionPanel } from './ui/MotionPanel.js';

export function App() {
  const [region, setRegion] = useState<RegionCode>('GB-LON');
  const [projectedKwh, setProjectedKwh] = useState(30);

  const debugMode = useMemo(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug'),
    [],
  );

  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  const {
    trigger: mutateRecommendationRaw,
    data: recommendationData,
    error: recommendationError,
    isPending: recommendationPending,
    stage: recommendationStage,
  } = useStreamingRecommendations();

  const {
    mutate: mutateCompareRaw,
    data: compareData,
    error: compareError,
    isPending: comparePending,
    reset: resetCompare,
  } = useCompareMutation();

  const {
    mutate: mutateTrendsRaw,
    data: trendsData,
    error: trendsError,
    isPending: trendsPending,
  } = useTrendsMutation();

  const [lastRecommendQuery, setLastRecommendQuery] = useState<RecommendationsQuery | null>(null);
  const [lastCompareQuery, setLastCompareQuery] = useState<CompareBody | null>(null);
  const [lastTrendsQuery, setLastTrendsQuery] = useState<{ region: RegionCode } | null>(null);

  const [compareScenarios, setCompareScenarios] = useState<ScenarioRow[]>(() =>
    buildStarterScenarios(),
  );
  const [compareWeights, setCompareWeights] = useState<CriteriaWeights>(DEFAULT_WEIGHTS);

  const [submittedScenarios, setSubmittedScenarios] = useState<ScenarioRow[]>([]);

  useEffect(() => {
    if (!recommendationData || recommendationData.refused) return;
    if (!lastRecommendQuery) return;
    setLastResult({
      kind: 'recommend',
      id: newResultId(),
      recordedAt: new Date().toISOString(),
      query: lastRecommendQuery,
      data: recommendationData,
    });
  }, [recommendationData, lastRecommendQuery]);

  useEffect(() => {
    if (!compareData || compareData.refused) return;
    if (!lastCompareQuery) return;
    setLastResult({
      kind: 'compare',
      id: newResultId(),
      recordedAt: new Date().toISOString(),
      query: lastCompareQuery,
      scenariosSnapshot: submittedScenarios,
      data: compareData,
    });
  }, [compareData, lastCompareQuery, submittedScenarios]);

  useEffect(() => {
    if (!trendsData || trendsData.refused) return;
    if (!lastTrendsQuery) return;
    setLastResult({
      kind: 'trends',
      id: newResultId(),
      recordedAt: new Date().toISOString(),
      query: lastTrendsQuery,
      data: trendsData,
    });
  }, [trendsData, lastTrendsQuery]);

  const pending = recommendationPending
    ? ({
        kind: 'recommend',
        ...(recommendationStage ? { stage: recommendationStage } : {}),
      } as const)
    : comparePending
      ? ({ kind: 'compare', scenarios: submittedScenarios } as const)
      : trendsPending
        ? ({ kind: 'trends' } as const)
        : null;
  const error = recommendationError
    ? ({ kind: 'recommend', message: recommendationError.message } as const)
    : compareError
      ? ({ kind: 'compare', error: compareError } as const)
      : trendsError
        ? ({ kind: 'trends', error: trendsError } as const)
        : null;

  const chartHighlight = useMemo<HighlightSpec | null>(() => {
    if (!lastResult) return null;
    if (lastResult.kind === 'recommend') {
      const top = [...lastResult.data.recommendations].sort((a, b) => a.priority - b.priority)[0];
      if (!top) return null;
      return { kind: 'recommend', window: { start: top.windowStart, end: top.windowEnd } };
    }
    if (lastResult.kind !== 'compare') return null;
    const compareResult = lastResult;
    return {
      kind: 'compare',
      bands: compareResult.data.ranked.map((row) => {
        const scenario = compareResult.scenariosSnapshot.find(
          (entry) => entry.id === row.scenarioId,
        );
        return {
          id: row.scenarioId,
          label: `#${rankIndex(compareResult.data.ranked, row.scenarioId) + 1} ${scenario?.label ?? row.scenarioId}`,
          start: scenario?.windowStart ?? '',
          end: scenario?.windowEnd ?? '',
          score: row.score,
        };
      }),
    };
  }, [lastResult]);

  const runRecommendation = (query: RecommendationsQuery): void => {
    setLastRecommendQuery(query);
    mutateRecommendationRaw(query);
  };
  const runCompare = (body: CompareBody, scenarios: readonly ScenarioRow[]): void => {
    setLastCompareQuery(body);
    setSubmittedScenarios([...scenarios]);
    mutateCompareRaw(body);
  };
  const runTrends = (targetRegion: RegionCode): void => {
    setLastTrendsQuery({ region: targetRegion });
    mutateTrendsRaw(targetRegion);
  };

  const didAutoLoadRef = useRef(false);
  useEffect(() => {
    if (didAutoLoadRef.current) return;
    didAutoLoadRef.current = true;
    runTrends(region);
  }, []);

  const handleRecommendationSubmit = (values: ScenarioFormValues) => {
    setProjectedKwh(values.kwh);
    runRecommendation({
      goal: values.goal,
      region,
      kwh: values.kwh,
      ...(values.deadline ? { deadline: values.deadline } : {}),
      preferences: values.preferences,
    });
  };

  const handleCompareSubmit = (body: CompareBody) => {
    runCompare(body, compareScenarios);
  };

  const handleTrendsTrigger = () => runTrends(region);

  return (
    <div className="h-screen overflow-hidden bg-page p-3 sm:p-4">
      <div className="flex h-full flex-col rounded-3xl border border-slate-200/70 bg-white shadow-soft">
        <DashboardHeader
          region={region}
          onRegionChange={setRegion}
          onTrendsClick={handleTrendsTrigger}
          trendsLoading={trendsPending}
        />

        <main className="grid min-h-0 flex-1 gap-4 overflow-hidden px-4 pb-4 lg:grid-cols-12">
          <div className="flex min-h-0 flex-col gap-4 overflow-hidden lg:col-span-3">
            <MotionPanel index={0} className="shrink-0">
              <ScenarioForm
                region={region}
                submitting={recommendationPending}
                onSubmit={handleRecommendationSubmit}
              />
            </MotionPanel>
            {debugMode ? (
              <MotionPanel index={4} className="flex-1 min-h-0">
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
                  onDismissCompareError={resetCompare}
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
                scenarios={compareScenarios}
                onScenariosChange={setCompareScenarios}
                weights={compareWeights}
                onWeightsChange={setCompareWeights}
                onSubmit={handleCompareSubmit}
                isPending={comparePending}
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

function rankIndex(ranked: readonly { scenarioId: string }[], scenarioId: string): number {
  return ranked.findIndex((row) => row.scenarioId === scenarioId);
}
