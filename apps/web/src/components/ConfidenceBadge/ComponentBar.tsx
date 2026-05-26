interface ComponentBarProps {
  label: string;

  value: number;

  weight: string;
}

export function ComponentBar({ label, value, weight }: ComponentBarProps) {
  const percent = Math.round(value * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-slate-600">
          {label} <span className="text-slate-400">· {weight}</span>
        </span>
        <span className="font-mono tabular-nums text-slate-900">{percent}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-emerald-600 transition-all duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
