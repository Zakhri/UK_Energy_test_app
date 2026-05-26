import { Leaf, Loader2, TrendingUp } from 'lucide-react';
import type { RegionCode } from '@uk-energy/shared';

import { useSignals } from '../../hooks/useSignals.js';
import { paletteForLevel } from './_lib/palettes.js';
import { regionLabelFor } from './_lib/regionOptions.js';
import { CarbonStatusPill } from './CarbonStatusPill.js';
import { DatePill } from './DatePill.js';
import { RegionPicker } from './RegionPicker.js';

interface DashboardHeaderProps {
  region: RegionCode;
  onRegionChange: (region: RegionCode) => void;
  onTrendsClick: () => void;
  trendsLoading: boolean;
}

export function DashboardHeader({
  region,
  onRegionChange,
  onTrendsClick,
  trendsLoading,
}: DashboardHeaderProps) {
  const { data, isLoading, isError } = useSignals('carbon', region);

  const latest = data?.signals.find(
    (
      signal,
    ): signal is {
      from: string;
      to: string;
      intensityGCo2PerKwh: number;
      index: string;
      kind: 'forecast' | 'actual';
    } => 'intensityGCo2PerKwh' in signal,
  );

  const regionLabel = regionLabelFor(region);
  const intensityLevel = latest?.index ?? 'moderate';
  const palette = paletteForLevel(intensityLevel);

  return (
    <header className="flex flex-col gap-4 px-6 pb-6 pt-6 md:flex-row md:items-start md:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <Leaf className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">
            When&apos;s the cleanest moment to use power?
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {regionLabel} grid at a {intensityLevel} carbon level — flexibility helps a lot.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onTrendsClick}
          disabled={trendsLoading}
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 transition hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-100 hover:shadow-soft disabled:cursor-not-allowed disabled:opacity-60"
          title="Compare today's grid to the past 7 days"
        >
          {trendsLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <TrendingUp className="h-3.5 w-3.5" />
          )}
          Today vs trend
        </button>
        <DatePill />
        <CarbonStatusPill
          loading={isLoading}
          error={isError}
          intensity={latest?.intensityGCo2PerKwh ?? null}
          level={latest?.index ?? null}
          palette={palette}
        />
        <RegionPicker region={region} onChange={onRegionChange} />
      </div>
    </header>
  );
}
