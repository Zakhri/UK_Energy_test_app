import { Leaf } from 'lucide-react';

import type { ImpactSummary } from './_lib/computeSummary.js';
import { StatCell } from './StatCell.js';

interface StatsStripProps {
  summary: ImpactSummary;
}

export function StatsStrip({ summary }: StatsStripProps) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCell
        label="Best window"
        value={`${summary.bestIntensity} g CO₂/kWh`}
        tone="emerald"
        icon={<Leaf className="h-3 w-3" />}
      />
      <StatCell
        label="vs. average day"
        value={
          summary.vsAvgPct >= 0 ? `↓ ${summary.vsAvgPct}% less` : `↑ ${-summary.vsAvgPct}% more`
        }
        tone="emerald"
      />
      <StatCell
        label="vs. worst time"
        value={
          summary.vsWorstPct >= 0
            ? `↓ ${summary.vsWorstPct}% less`
            : `↑ ${-summary.vsWorstPct}% more`
        }
        tone="emerald"
      />
      <StatCell
        label="Estimated emissions"
        value={`${summary.min.kgCo2.toFixed(3)} kg CO₂`}
        tone="slate"
      />
    </div>
  );
}
