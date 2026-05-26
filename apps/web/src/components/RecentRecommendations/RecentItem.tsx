import { Lightbulb, Scale, TrendingUp } from 'lucide-react';

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

        <p className="line-clamp-2 text-[11px] leading-relaxed text-slate-500 group-hover:text-slate-700">
          {entry.preview.summary}
        </p>
      </button>
    </li>
  );
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
    tag: `${entry.query.region}`,
    pillClass: 'bg-amber-50 text-amber-800',
  };
}
