import { History } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-5 text-center">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <History className="h-4 w-4" />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        Your recent asks will appear here so you can re-run them in one click.
      </p>
    </div>
  );
}
