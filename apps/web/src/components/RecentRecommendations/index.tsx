import { History, Trash2 } from 'lucide-react';

import type { StoredEntry } from '../../state/storage.js';
import { EmptyState } from './EmptyState.js';
import { RecentItem } from './RecentItem.js';

interface RecentRecommendationsProps {
  entries: readonly StoredEntry[];
  activeId: string | null;
  onRerun: (entry: StoredEntry) => void;
  onCleared: () => void;
}

export function RecentRecommendations({
  entries,
  activeId,
  onRerun,
  onCleared,
}: RecentRecommendationsProps) {
  return (
    <section className="panel flex h-full min-h-0 flex-col transition-shadow hover:shadow-lift">
      <div className="panel-heading">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <History className="h-4 w-4" />
          </div>
          <div>
            <h2 className="panel-title">Recent</h2>
            <p className="panel-subtitle">Your last few asks — click to re-run</p>
          </div>
        </div>
        {entries.length > 0 ? (
          <button
            type="button"
            onClick={onCleared}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Clear recent history"
            title="Clear all"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {entries.length === 0 ? (
        <div className="flex-1 min-h-0">
          <EmptyState />
        </div>
      ) : (
        <ul className="flex-1 min-h-0 space-y-2 overflow-y-auto pr-1 scroll-area-quiet">
          {entries.map((entry) => (
            <RecentItem
              key={entry.id}
              entry={entry}
              active={entry.id === activeId}
              onRerun={onRerun}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
