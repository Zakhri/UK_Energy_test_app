import { Activity } from 'lucide-react';
import { useMemo } from 'react';
import type { RegionCode } from '@uk-energy/shared';

import { useSignals } from '../../hooks/useSignals.js';
import { formatTime } from '../../lib/format.js';
import { computeSummary } from './_lib/computeSummary.js';
import type { HighlightSpec } from './_lib/highlightSpec.js';
import { nearestTick } from './_lib/nearestTick.js';
import type { ImpactPoint } from './_lib/types.js';
import { ImpactBarChart, type ResolvedBand } from './ImpactBarChart.js';
import { StatsStrip } from './StatsStrip.js';
import { Skeleton } from '@/ui/Skeleton.js';

interface SimulatedImpactChartProps {
  region: RegionCode;

  kwh?: number;

  highlight?: HighlightSpec | null;
}

export function SimulatedImpactChart({
  region,
  kwh = 30,
  highlight = null,
}: SimulatedImpactChartProps) {
  const { data, isLoading, isError } = useSignals('carbon', region);

  const points = useMemo<ImpactPoint[]>(() => {
    if (!data) return [];
    return data.signals
      .filter(
        (
          signal,
        ): signal is {
          from: string;
          to: string;
          intensityGCo2PerKwh: number;
          index: string;
          kind: 'forecast' | 'actual';
          unreliable?: boolean;
        } => 'intensityGCo2PerKwh' in signal,
      )
      .slice(0, 96)
      .map((reading) => ({
        time: formatTime(reading.from),
        iso: reading.from,
        intensity: Math.round(reading.intensityGCo2PerKwh),

        kgCo2: Math.round((reading.intensityGCo2PerKwh * kwh) / 10) / 100,
        index: reading.index,

        unreliable: reading.unreliable === true,
      }));
  }, [data, kwh]);

  const summary = useMemo(() => computeSummary(points, kwh), [points, kwh]);

  const nowTick = useMemo(() => {
    if (points.length === 0) return null;
    return nearestTick(points, Date.now());
  }, [points]);

  const resolved = useMemo(() => resolveBands(highlight, points), [highlight, points]);

  return (
    <section className="panel transition-shadow hover:shadow-lift">
      <div className="panel-heading">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h2 className="panel-title">Simulated impact</h2>
            <p className="panel-subtitle">If you run {kwh} kWh at each time of day</p>
          </div>
        </div>
      </div>

      {summary ? <StatsStrip summary={summary} /> : null}

      {summary && summary.unreliableCount > 0 ? (
        <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
          ⚠ {summary.unreliableCount} forecast{' '}
          {summary.unreliableCount === 1 ? 'hour was' : 'hours were'} flagged as physically
          implausible (intensity &lt; 30 g/kWh — the UK grid&apos;s realistic floor). Those bars are
          shown striped and excluded from the stats above.
        </p>
      ) : null}

      {isError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Impact projection unavailable — using fallback recommendation logic.
        </div>
      ) : isLoading || points.length === 0 ? (
        <Skeleton variant="chart" />
      ) : (
        <ImpactBarChart points={points} nowTick={nowTick} resolvedBands={resolved} />
      )}
    </section>
  );
}

function resolveBands(
  highlight: HighlightSpec | null | undefined,
  points: readonly ImpactPoint[],
): { scheme: 'recommend' | 'compare' | 'none'; bands: ResolvedBand[] } {
  if (!highlight || points.length === 0) return { scheme: 'none', bands: [] };

  if (highlight.kind === 'recommend') {
    const startTick = nearestTick(points, new Date(highlight.window.start).getTime());
    const endTick = nearestTick(points, new Date(highlight.window.end).getTime());
    if (!startTick || !endTick || startTick === endTick) {
      return { scheme: 'none', bands: [] };
    }
    return {
      scheme: 'recommend',
      bands: [{ id: 'best', startTick, endTick, label: 'Best window', score: 1 }],
    };
  }

  const bands: ResolvedBand[] = [];
  for (const band of highlight.bands) {
    const startTick = nearestTick(points, new Date(band.start).getTime());
    const endTick = nearestTick(points, new Date(band.end).getTime());
    if (!startTick || !endTick || startTick === endTick) continue;
    bands.push({ id: band.id, startTick, endTick, label: band.label, score: band.score });
  }
  return { scheme: 'compare', bands };
}
