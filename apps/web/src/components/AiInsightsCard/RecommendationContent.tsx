import {
  AlertTriangle,
  Clock,
  Leaf,
  Lightbulb,
  Link2,
  Moon,
  PoundSterling,
  Target,
  TrendingDown,
  Zap,
} from 'lucide-react';
import type { PreferenceCode, RecommendationsResponse } from '@uk-energy/shared';

import { useCurrentIntensity } from '../../hooks/useCurrentIntensity.js';
import { formatDateTime, formatPounds } from '../../lib/format.js';
import { ConfidenceBadge } from '../ConfidenceBadge/index.js';

export function RecommendationContent({ data }: { data: RecommendationsResponse }) {
  const nowIntensity = useCurrentIntensity(data.inputs.region);
  return (
    <section className="relative panel overflow-hidden transition-shadow hover:shadow-lift">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700"
      />
      <div className="pl-2">
        <div className="panel-heading">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Lightbulb className="h-4 w-4" />
            </div>
            <div>
              <h2 className="panel-title">Recommended timing</h2>
              <p className="panel-subtitle">Based on live grid &amp; weather data</p>
            </div>
          </div>
          <ConfidenceBadge confidence={data.confidence} />
        </div>

        <p className="text-[15px] leading-relaxed text-slate-800">{data.summary}</p>

        {data.inputs.preferences.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
            <Target className="h-3 w-3 text-slate-400" />
            <span className="font-semibold uppercase tracking-wider">Optimised for</span>
            {data.inputs.preferences.map((preference) => {
              const view = preferenceView(preference);
              return (
                <span
                  key={preference}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${view.className}`}
                  title={view.title}
                >
                  <view.Icon className="h-3 w-3" />
                  {view.label}
                </span>
              );
            })}
          </div>
        ) : null}

        <ul className="mt-5 space-y-3">
          {data.recommendations.map((recommendation, index) => (
            <li
              key={index}
              className="group rounded-2xl border border-slate-200/70 bg-surface-muted/60 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50/40 hover:shadow-soft"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span
                    className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-md bg-emerald-100 px-1.5 font-mono text-[11px] font-semibold text-emerald-800"
                    title={`Ranked #${recommendation.priority} by the AI: 1 = best fit for your preferences and deadline.`}
                  >
                    #{recommendation.priority}
                  </span>
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-medium text-slate-700">
                    {formatDateTime(recommendation.windowStart)}
                  </span>
                  <span className="text-slate-400">→</span>
                  <span className="font-medium text-slate-700">
                    {formatDateTime(recommendation.windowEnd)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800"
                    title="Grams of CO₂ per kWh of electricity drawn from the grid in this window. Lower = cleaner. UK average ≈ 200 g/kWh."
                  >
                    <Leaf className="h-3 w-3" />
                    <span className="font-mono tabular-nums">
                      {Math.round(recommendation.expectedCarbonGCo2)}
                    </span>
                    <span className="text-emerald-600/80">g/kWh</span>
                  </span>
                  {recommendation.expectedCostPounds != null ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800"
                      title="Estimated wholesale electricity cost per kWh for this window. Retail (your bill) is typically higher because of network + standing charges."
                    >
                      <span className="font-mono tabular-nums">
                        {formatPounds(recommendation.expectedCostPounds, 2)}
                      </span>
                      <span className="text-amber-700/80">/kWh</span>
                    </span>
                  ) : null}
                </div>
              </div>
              {/* Per-row "saves X kg vs now" chip — only shows when we can
                  compute it AND the saving is positive + non-trivial. Lets
                  the user compare each alternative window's value (#2 is
                  often cheaper but saves less CO₂; the chip surfaces that
                  trade visually without forcing them to do the math). */}
              {(() => {
                if (nowIntensity === null) return null;
                const nowKg = (nowIntensity * data.inputs.kwh) / 1000;
                const recKg = (recommendation.expectedCarbonGCo2 * data.inputs.kwh) / 1000;
                const saved = nowKg - recKg;
                if (saved < 0.05) return null;
                return (
                  <div
                    className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800"
                    title={`This window: ${recKg.toFixed(2)} kg vs charging now: ${nowKg.toFixed(2)} kg`}
                  >
                    <TrendingDown className="h-3 w-3" />
                    saves <span className="font-mono tabular-nums">{saved.toFixed(2)}</span>
                    kg CO₂ vs now
                  </div>
                );
              })()}
              <p className="mt-2 text-sm leading-relaxed text-slate-800">
                {recommendation.reasoning}
              </p>
              <div className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wider text-slate-400">
                  Trade-off
                </span>
                <span className="leading-relaxed">{recommendation.tradeoffs}</span>
              </div>
            </li>
          ))}
        </ul>

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
            {data.meta.degraded ? (
              <span className="ml-auto rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                degraded data
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Per-preference view metadata for the "Optimised for" chips. Mirrors the
 * goal-vocabulary rule in the v1 system prompt — gives the user immediate
 * visual confirmation that their selection actually influenced the picker.
 */
function preferenceView(preference: PreferenceCode): {
  Icon: typeof Leaf;
  label: string;
  className: string;
  title: string;
} {
  switch (preference) {
    case 'low-carbon':
      return {
        Icon: Leaf,
        label: 'Low carbon',
        className: 'bg-emerald-50 text-emerald-800',
        title: 'Picker weighted toward windows with the lowest average grid carbon intensity.',
      };
    case 'low-price':
      return {
        Icon: PoundSterling,
        label: 'Low price',
        className: 'bg-amber-50 text-amber-800',
        title: 'Picker weighted toward windows with the lowest average wholesale price.',
      };
    case 'avoid-peak':
      return {
        Icon: Moon,
        label: 'Avoid peak',
        className: 'bg-indigo-50 text-indigo-800',
        title: 'Picker penalised windows overlapping the UK demand peak (16:00–20:00 UTC).',
      };
    case 'fast-completion':
      return {
        Icon: Zap,
        label: 'Fast completion',
        className: 'bg-orange-50 text-orange-800',
        title: 'Picker favoured earlier windows so the task finishes sooner.',
      };
  }
}
