import type { ReactNode } from 'react';

interface StatCellProps {
  label: string;
  value: string;

  tone: 'emerald' | 'slate';
  icon?: ReactNode;
}

export function StatCell({ label, value, tone, icon }: StatCellProps) {
  const valueClass = tone === 'emerald' ? 'text-emerald-700' : 'text-slate-900';
  return (
    <div className="rounded-xl border border-slate-200/70 bg-surface-muted/40 px-3 py-2.5 transition-colors hover:border-emerald-200">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div
        className={`mt-1 flex items-center gap-1.5 font-mono text-sm font-semibold tabular-nums ${valueClass}`}
      >
        {icon}
        {value}
      </div>
    </div>
  );
}
