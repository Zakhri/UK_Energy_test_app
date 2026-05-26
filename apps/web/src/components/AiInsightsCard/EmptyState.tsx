import { Compass, Wand2 } from 'lucide-react';

interface EmptyStateProps {
  onTryExample?: () => void;
}

export function EmptyState({ onTryExample }: EmptyStateProps) {
  return (
    <section className="panel flex h-full min-h-[260px] flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 shadow-soft">
        <Compass className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-800">Ready when you are</h3>
      <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-slate-500">
        Tell us what you&apos;re running on the left — we&apos;ll pick the cleanest, cheapest window
        before your deadline.
      </p>
      <ul className="mt-5 space-y-1.5 text-xs text-slate-500">
        <li>· EV charging, heat pump, appliance, home battery</li>
        <li>· Lowest-carbon window inside the deadline</li>
        <li>· Cites the live data sources used</li>
      </ul>

      {onTryExample ? (
        <button
          type="button"
          onClick={onTryExample}
          className="mt-6 inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-900 hover:shadow-lift"
        >
          <Wand2 className="h-3.5 w-3.5" />
          Try an example — EV, 40 kWh, by 07:00
        </button>
      ) : null}
    </section>
  );
}
