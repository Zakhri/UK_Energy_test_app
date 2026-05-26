import { ArrowRight, Leaf, PoundSterling, Trophy } from 'lucide-react';

import { cn } from '../../lib/cn.js';
import { formatDateTime } from '../../lib/format.js';
import type { ScenarioRow } from '../CompareScenarios/index.js';
import { computeRowBreakdown, type AxisRank, type RangeContext } from './_lib/computeBreakdown.js';
import { toIsoSafe } from './_lib/toIsoSafe.js';

interface RankedRowItemProps {
  ranking: {
    readonly scenarioId: string;
    readonly score: number;
    readonly rationale: string;
    readonly expectedCarbonGCo2: number;
    readonly expectedCostPounds?: number;
  };

  index: number;
  scenario: ScenarioRow | undefined;

  rangeContext: RangeContext;
}

export function RankedRowItem({ ranking, index, scenario, rangeContext }: RankedRowItemProps) {
  const isTop = index === 0;
  const breakdown = computeRowBreakdown(ranking, rangeContext);
  return (
    <li
      className={cn(
        'rounded-xl border px-3.5 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft',
        isTop
          ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
          : 'border-slate-200/70 bg-white text-slate-700',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold',
            isTop ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600',
          )}
        >
          {isTop ? <Trophy className="h-3.5 w-3.5" /> : index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-medium">{scenario?.label ?? ranking.scenarioId}</span>
            <span
              className="rounded-full bg-white/70 px-2 py-0.5 font-mono text-[10px] tabular-nums text-slate-600"
              title="AI's weighted ranking 0–1. Higher = better fit for your sliders."
            >
              score {ranking.score.toFixed(2)}
            </span>
          </div>
          {scenario ? (
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
              <span>{formatDateTime(toIsoSafe(scenario.windowStart))}</span>
              <ArrowRight className="h-3 w-3 text-slate-400" />
              <span>{formatDateTime(toIsoSafe(scenario.windowEnd))}</span>
            </div>
          ) : null}
          <p className="mt-1.5 text-[12px] leading-relaxed text-slate-700">{ranking.rationale}</p>

          <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
            <BreakdownBadge
              icon={<Leaf className="h-3 w-3" strokeWidth={2.5} />}
              rank={breakdown.carbon.rank}
              valueText={`${Math.round(breakdown.carbon.value)} gCO₂/kWh`}
              axisLabel="carbon"
              palette="emerald"
            />
            {breakdown.cost ? (
              <BreakdownBadge
                icon={<PoundSterling className="h-3 w-3" strokeWidth={2.5} />}
                rank={breakdown.cost.rank}
                valueText={formatCostPerKwh(breakdown.cost.value)}
                axisLabel="cost"
                palette="amber"
              />
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

interface BreakdownBadgeProps {
  icon: React.ReactNode;
  rank: AxisRank;
  valueText: string;
  axisLabel: string;
  palette: 'emerald' | 'amber';
}

/**
 * A single axis badge (carbon / cost). The colour ENCODES the rank within
 * the set, so users can tell at a glance which row is best/worst on each
 * dimension without doing arithmetic:
 *   - best   → palette colour (emerald/amber), strong
 *   - middle → slate, subtle
 *   - worst  → orange-tinted (warning) regardless of palette
 *   - only   → slate, subtle ("not comparable, single row")
 */
function BreakdownBadge({ icon, rank, valueText, axisLabel, palette }: BreakdownBadgeProps) {
  const RANK_LABELS: Record<AxisRank, string> = {
    best: `cleanest in set`,
    middle: `mid-pack`,
    worst: `worst in set`,
    only: `only window`,
  };
  // Carbon palette overrides label text for axis nuance.
  const axisAdjective: Record<string, Record<AxisRank, string>> = {
    carbon: { best: 'cleanest', middle: 'mid-pack', worst: 'dirtiest', only: 'only' },
    cost: { best: 'cheapest', middle: 'mid-pack', worst: 'priciest', only: 'only' },
  };
  const adjective = axisAdjective[axisLabel]?.[rank] ?? RANK_LABELS[rank];

  const colour =
    rank === 'worst'
      ? 'bg-orange-50 text-orange-800 ring-1 ring-orange-200'
      : rank === 'best'
        ? palette === 'emerald'
          ? 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300'
          : 'bg-amber-100 text-amber-900 ring-1 ring-amber-300'
        : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono tabular-nums',
        colour,
      )}
      title={`${valueText} — ${adjective} ${axisLabel} in this set`}
    >
      {icon}
      <span>{valueText}</span>
      <span className="text-[10px] font-normal opacity-80">· {adjective}</span>
    </span>
  );
}

/**
 * Format `expectedCostPounds` (£/kWh) for display.
 *
 * `value.toFixed(2)` was rounding sub-pence values to "£0.00", which looked
 * like "free electricity!?" to users. Below 1 p/kWh we show "<£0.01" so the
 * UI never lies about the cost being literally zero.
 */
function formatCostPerKwh(value: number): string {
  if (value <= 0) return '— £/kWh';
  if (value < 0.01) return '<£0.01/kWh';
  return `£${value.toFixed(2)}/kWh`;
}
