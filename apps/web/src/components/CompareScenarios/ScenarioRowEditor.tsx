import { Trash2 } from 'lucide-react';

import type { ScenarioRow } from './types.js';

interface ScenarioRowEditorProps {
  scenario: ScenarioRow;
  index: number;
  canRemove: boolean;
  onChange: (patch: Partial<ScenarioRow>) => void;
  onRemove: () => void;
}

export function ScenarioRowEditor({
  scenario,
  index,
  canRemove,
  onChange,
  onRemove,
}: ScenarioRowEditorProps) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-surface-muted/60 p-3 transition-colors hover:border-emerald-200">
      <div className="mb-2 flex items-center justify-between gap-2">
        <input
          type="text"
          value={scenario.label}
          onChange={(event) => onChange({ label: event.target.value })}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-slate-800 placeholder:text-slate-400 hover:border-slate-200 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          placeholder="Label this window"
          maxLength={64}
          aria-label={`Window ${index + 1} label`}
        />
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
          aria-label="Remove window"
          title={canRemove ? 'Remove window' : 'Need at least 2 windows'}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block min-w-0">
          <span className="block text-[10px] uppercase tracking-wider text-slate-500">Start</span>
          <input
            type="datetime-local"
            value={scenario.windowStart}
            onChange={(event) => onChange({ windowStart: event.target.value })}
            required
            className="mt-0.5 block w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-800 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <label className="block min-w-0">
          <span className="block text-[10px] uppercase tracking-wider text-slate-500">End</span>
          <input
            type="datetime-local"
            value={scenario.windowEnd}
            onChange={(event) => onChange({ windowEnd: event.target.value })}
            required
            className="mt-0.5 block w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-800 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <label className="col-span-2 flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[10px] uppercase tracking-wider text-slate-500">
            Energy
          </span>
          <input
            type="number"
            min={0.1}
            max={200}
            step={0.5}
            value={scenario.kwh}
            onChange={(event) => onChange({ kwh: Number(event.target.value) || 0 })}
            required
            className="block w-24 min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-right text-[12px] font-mono tabular-nums text-slate-800 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
          <span className="text-[11px] text-slate-500">kWh</span>
        </label>
      </div>
    </div>
  );
}
