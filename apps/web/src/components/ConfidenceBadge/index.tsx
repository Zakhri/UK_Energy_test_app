import { Info, X } from 'lucide-react';
import { useState } from 'react';
import type { ConfidenceScoreDto } from '@uk-energy/shared';

import { cn } from '../../lib/cn.js';
import { ComponentBar } from './ComponentBar.js';
import { variantFor } from './_lib/variantFor.js';
import { ConfidenceRing } from '@/ui/ConfidenceRing.js';

interface ConfidenceBadgeProps {
  confidence: ConfidenceScoreDto;
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const variant = variantFor(confidence.recommendation);

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setShowBreakdown((prev) => !prev)}
        className={cn(
          'inline-flex items-center gap-2.5 rounded-2xl border px-2 py-1.5 text-xs font-medium shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift',
          variant.classes,
        )}
        aria-label="Show confidence breakdown"
        aria-expanded={showBreakdown}
      >
        <ConfidenceRing value={confidence.overall} size={40} stroke={4} />
        <span className="pr-2">
          <span className="block text-[11px] font-semibold leading-tight">{variant.label}</span>
          <span className="block text-[10px] uppercase tracking-wider opacity-70">confidence</span>
        </span>
        <Info className="mr-1 h-3.5 w-3.5 opacity-60" />
      </button>

      {showBreakdown ? (
        <div
          className="absolute right-0 top-full z-20 mt-2 w-80 origin-top-right rounded-2xl border border-slate-200 bg-white p-4 shadow-lift animate-scale-in"
          role="dialog"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">Confidence breakdown</span>
            <button
              type="button"
              onClick={() => setShowBreakdown(false)}
              className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mb-4 flex items-center gap-4">
            <ConfidenceRing value={confidence.overall} size={64} stroke={6} />
            <div>
              <div className="text-2xl font-semibold text-slate-900">
                {Math.round(confidence.overall * 100)}
                <span className="text-sm text-slate-400">/100</span>
              </div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500">
                {variant.label}
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <ComponentBar
              label="Data freshness"
              value={confidence.components.dataFreshness}
              weight="40%"
            />
            <ComponentBar
              label="Context coverage"
              value={confidence.components.contextCoverage}
              weight="30%"
            />
            <ComponentBar label="Citations" value={confidence.components.citations} weight="20%" />
            <ComponentBar
              label="Schema validity"
              value={confidence.components.schemaValidity}
              weight="10%"
            />
          </div>

          {confidence.caveats.length > 0 ? (
            <ul className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
              {confidence.caveats.map((caveat, index) => (
                <li key={index} className="leading-relaxed">
                  · {caveat}
                </li>
              ))}
            </ul>
          ) : null}

          <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-500">
            We combine how fresh the grid data is, how complete your inputs are, how many sources
            back the answer, and whether the model&apos;s response matched our expected format.
          </p>
        </div>
      ) : null}
    </div>
  );
}
