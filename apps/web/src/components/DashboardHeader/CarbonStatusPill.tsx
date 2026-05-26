import { Wind } from 'lucide-react';

import { cn } from '../../lib/cn.js';
import { friendlyHeadline } from './_lib/friendlyHeadline.js';
import type { IntensityPalette } from './_lib/palettes.js';

interface CarbonStatusPillProps {
  loading: boolean;
  error: boolean;
  intensity: number | null;
  level: string | null;
  palette: IntensityPalette;
}

export function CarbonStatusPill({
  loading,
  error,
  intensity,
  level,
  palette,
}: CarbonStatusPillProps) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-soft">
        <Wind className="h-3.5 w-3.5 animate-soft-bounce text-slate-400" />
        Reading the grid…
      </span>
    );
  }

  if (error || intensity == null) {
    return (
      <span className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 shadow-soft">
        Grid data unavailable
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium shadow-soft',
        palette.border,
        palette.bg,
        palette.text,
      )}
    >
      <span className="relative flex h-2 w-2 items-center justify-center">
        <span
          className={cn(
            'absolute inline-flex h-full w-full rounded-full animate-pulse-ring',
            palette.dot,
          )}
        />
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', palette.dot)} />
      </span>
      {friendlyHeadline(level)}
      <span className="font-mono tabular-nums opacity-70">{Math.round(intensity)}</span>
      <span className="text-[10px] uppercase tracking-wider opacity-60">g/kWh</span>
    </span>
  );
}
