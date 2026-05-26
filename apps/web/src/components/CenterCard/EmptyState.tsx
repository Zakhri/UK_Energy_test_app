import { ArrowLeft, Sparkles } from 'lucide-react';

export function CenterCardEmptyState() {
  return (
    <section className="panel flex h-full flex-col items-center justify-center text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        <Sparkles className="h-5 w-5" />
      </div>
      <h2 className="mb-1 text-base font-semibold text-slate-800">No result yet</h2>
      <p className="mb-4 max-w-xs text-[13px] leading-relaxed text-slate-500">
        Choose a task on the left — pick a window for charging an EV, running a heat pump or an
        appliance, or compare your own scenarios on the right.
      </p>
      <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-500">
        <ArrowLeft className="h-3 w-3" />
        Start with the form
      </div>
    </section>
  );
}
