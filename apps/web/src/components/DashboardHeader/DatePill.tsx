import { Calendar } from 'lucide-react';

export function DatePill() {
  const formatted = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return (
    <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-soft">
      <Calendar className="h-3.5 w-3.5 text-slate-400" />
      {formatted}
    </span>
  );
}
