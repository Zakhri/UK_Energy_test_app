import { cn } from '../../lib/cn.js';

interface WeightSliderProps {
  label: string;

  value: number;

  share: number;
  onChange: (value: number) => void;
  accent: 'emerald' | 'amber';
}

export function WeightSlider({ label, value, share, onChange, accent }: WeightSliderProps) {
  const accentClass = {
    emerald: 'accent-emerald-600',
    amber: 'accent-amber-500',
  }[accent];
  return (
    <label className="flex items-center gap-3 text-[11px]">
      <span className="w-32 shrink-0 text-slate-700">{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={cn('h-1.5 flex-1 cursor-pointer', accentClass)}
      />
      <span className="w-10 text-right font-mono tabular-nums text-slate-600">
        {Math.round(share * 100)}%
      </span>
    </label>
  );
}
