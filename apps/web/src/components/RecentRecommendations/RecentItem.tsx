import { Lightbulb, MapPin, Scale, TrendingUp } from 'lucide-react';
import type { RegionCode } from '@uk-energy/shared';

import { regionLabelFor } from '../DashboardHeader/_lib/regionOptions.js';
import { cn } from '../../lib/cn.js';
import type { StoredEntry } from '../../state/storage.js';
import { goalLabel, relativeTime } from './_lib/formatPreview.js';

interface RecentItemProps {
  entry: StoredEntry;
  active: boolean;
  onRerun: (entry: StoredEntry) => void;
}

export function RecentItem({ entry, active, onRerun }: RecentItemProps) {
  const view = viewForEntry(entry);
  const region = regionLabelFor(regionForEntry(entry));
  return (
    <li>
      <button
        type="button"
        onClick={() => onRerun(entry)}
        className={cn(
          'group block w-full rounded-xl border bg-white px-3 py-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft',
          active
            ? 'border-emerald-300 bg-emerald-50/40 shadow-soft'
            : 'border-slate-200/70 hover:border-emerald-300 hover:bg-emerald-50/30',
        )}
      >
        <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium',
              view.pillClass,
            )}
          >
            <view.Icon className="h-3 w-3" />
            <span>{view.kindLabel}</span>
            <span className="opacity-70">·</span>
            <span>{view.tag}</span>
          </span>
          <span className="text-slate-400">{relativeTime(entry.recordedAt)}</span>
        </div>

        <div className="mb-1 flex items-center gap-1 text-[10px] text-slate-500">
          <MapPin className="h-2.5 w-2.5 text-slate-400" />
          <span>{region}</span>
        </div>

        <p className="line-clamp-2 text-[11px] leading-relaxed text-slate-500 group-hover:text-slate-700">
          {entry.preview.summary}
        </p>
      </button>
    </li>
  );
}

function regionForEntry(entry: StoredEntry): RegionCode {
  if (entry.kind === 'recommend') return entry.query.region;
  if (entry.kind === 'compare') return entry.query.region as RegionCode;
  return entry.query.region;
}

function viewForEntry(entry: StoredEntry): {
  Icon: typeof Lightbulb;
  kindLabel: string;
  tag: string;
  pillClass: string;
} {
  if (entry.kind === 'recommend') {
    return {
      Icon: Lightbulb,
      kindLabel: 'Recommend',
      tag: `${goalLabel(entry.query.goal)} · ${entry.query.kwh} kWh`,
      pillClass: 'bg-emerald-50 text-emerald-800',
    };
  }
  if (entry.kind === 'compare') {
    const scenarioCount = entry.query.scenarios.length;
    return {
      Icon: Scale,
      kindLabel: 'Compare',
      tag: `${scenarioCount} scenario${scenarioCount === 1 ? '' : 's'}`,
      pillClass: 'bg-indigo-50 text-indigo-800',
    };
  }
  return {
    Icon: TrendingUp,
    kindLabel: 'Trend',
    tag: 'Today vs week',
    pillClass: 'bg-amber-50 text-amber-800',
  };
}
