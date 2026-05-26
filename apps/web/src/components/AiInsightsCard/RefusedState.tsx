import { AlertTriangle } from 'lucide-react';
import type { RecommendationsResponse } from '@uk-energy/shared';

export function RefusedState({ data }: { data: RecommendationsResponse }) {
  return (
    <section className="panel border-amber-200 bg-amber-50/30">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
        <AlertTriangle className="h-4 w-4" />
        That&apos;s outside what we can help with
      </div>
      <p className="text-sm leading-relaxed text-amber-900/80">
        {data.refusalReason ??
          'Try asking about EV charging, heat pump scheduling, or when to run an appliance.'}
      </p>
    </section>
  );
}
