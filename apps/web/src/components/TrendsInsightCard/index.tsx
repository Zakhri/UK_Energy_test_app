import { AlertTriangle, Link2, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { TrendsInsightResponse } from '@uk-energy/shared';

import type { ApiError } from '../../lib/api-client.js';
import { ProgressStages } from '@/ui/ProgressStages.js';

interface TrendsInsightCardProps {
  data: TrendsInsightResponse | null;
  loading: boolean;
  error: ApiError | null;
}

export function TrendsInsightCard({ data, loading, error }: TrendsInsightCardProps) {
  if (loading) {
    return (
      <section className="relative panel overflow-hidden">
        <RibbonAmber />
        <div className="pl-2">
          <Heading />
          <div className="rounded-2xl border border-slate-200/70 bg-surface-muted/40 p-4">
            <ProgressStages
              stages={[
                'Pulling 7 days of carbon history…',
                'Computing today vs baseline…',
                'Asking the model to explain why…',
              ]}
            />
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel border-red-200 bg-red-50/30">
        <Heading />
        <p className="rounded-xl border border-red-200 bg-red-50/40 px-3 py-3 text-xs text-red-800">
          {error.message}
        </p>
      </section>
    );
  }

  if (!data) return null;

  if (data.refused) {
    return (
      <section className="panel border-amber-200 bg-amber-50/30">
        <Heading />
        <p className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-3 text-xs text-amber-900">
          {data.refusalReason ?? "That's outside what we can help with."}
        </p>
      </section>
    );
  }

  const { trends } = data;

  return (
    <section className="relative panel overflow-hidden transition-shadow hover:shadow-lift">
      <RibbonAmber />
      <div className="pl-2">
        <Heading />

        {trends ? (
          <div className="mb-4 grid grid-cols-3 gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/40 p-3.5">
            <Stat
              label="Today avg"
              value={`${Math.round(trends.todayAvgGCo2)}`}
              unit="g/kWh"
              accent="text-amber-900"
            />
            <Stat
              label="Last 7 days avg"
              value={`${Math.round(trends.weekAvgGCo2)}`}
              unit="g/kWh"
              accent="text-slate-700"
            />
            <DeltaStat verdict={trends.verdict} deltaPct={trends.deltaPct} />
          </div>
        ) : null}

        <p className="text-[15px] leading-relaxed text-slate-800">{data.headline}</p>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-600">{data.explanation}</p>

        {data.drivers.length > 0 ? (
          <ul className="mt-4 space-y-1.5">
            {data.drivers.map((driver, index) => (
              <li
                key={index}
                className="flex items-start gap-2 rounded-xl border border-slate-200/70 bg-surface-muted/60 px-3 py-2 text-[12px] leading-relaxed text-slate-700"
              >
                <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-semibold text-amber-800">
                  {index + 1}
                </span>
                <span>{driver}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {data.caveats.length > 0 ? (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
            <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-amber-900">
              <AlertTriangle className="h-3.5 w-3.5" />
              Worth knowing
            </div>
            <ul className="space-y-1 text-xs text-amber-900/80">
              {data.caveats.map((caveat, index) => (
                <li key={index} className="leading-relaxed">
                  · {caveat}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {data.citations.length > 0 ? (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <Link2 className="h-3.5 w-3.5 text-slate-400" />
            <span>Sources</span>
            {data.citations.map((citation) => (
              <span
                key={citation}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 font-mono text-[10px] text-slate-600"
              >
                {citation}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RibbonAmber() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-amber-400 via-amber-500 to-orange-500"
    />
  );
}

function Heading() {
  return (
    <div className="panel-heading">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
          <TrendingUp className="h-4 w-4" />
        </div>
        <div>
          <h2 className="panel-title">Today vs trend</h2>
          <p className="panel-subtitle">Past 7 days vs current grid intensity</p>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit: string;
  accent: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <span className={`mt-1 font-mono text-lg font-semibold tabular-nums ${accent}`}>
        {value}
        <span className="ml-1 text-[10px] font-normal text-slate-500">{unit}</span>
      </span>
    </div>
  );
}

function DeltaStat({
  verdict,
  deltaPct,
}: {
  verdict: 'cleaner' | 'similar' | 'dirtier';
  deltaPct: number;
}) {
  const Icon = verdict === 'cleaner' ? TrendingDown : verdict === 'dirtier' ? TrendingUp : Minus;
  const accent =
    verdict === 'cleaner'
      ? 'text-emerald-700'
      : verdict === 'dirtier'
        ? 'text-orange-700'
        : 'text-slate-600';
  const verdictLabel =
    verdict === 'cleaner' ? 'cleaner' : verdict === 'dirtier' ? 'dirtier' : 'similar';
  const sign = deltaPct > 0 ? '+' : '';
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Delta
      </span>
      <span
        className={`mt-1 flex items-center gap-1 font-mono text-lg font-semibold tabular-nums ${accent}`}
      >
        <Icon className="h-4 w-4" />
        {sign}
        {deltaPct.toFixed(1)}%
      </span>
      <span className={`text-[10px] font-medium ${accent}`}>{verdictLabel} than usual</span>
    </div>
  );
}
