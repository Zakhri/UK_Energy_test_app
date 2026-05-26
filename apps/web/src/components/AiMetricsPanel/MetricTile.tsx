import { AnimatedNumber } from '@/ui/AnimatedNumber';
import type { ComponentType } from 'react';

interface MetricTileProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  ready: boolean;
}

export function MetricTile({
  icon: Icon,
  label,
  value,
  prefix,
  suffix,
  decimals = 0,
  ready,
}: MetricTileProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200/70 bg-surface-muted/60 px-3.5 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50/40">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
        <Icon className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-emerald-600" />
      </div>
      <div className="font-mono text-lg font-semibold tabular-nums text-slate-900">
        {ready ? (
          <AnimatedNumber
            value={value}
            decimals={decimals}
            {...(prefix !== undefined ? { prefix } : {})}
            {...(suffix !== undefined ? { suffix } : {})}
          />
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </div>
    </div>
  );
}
