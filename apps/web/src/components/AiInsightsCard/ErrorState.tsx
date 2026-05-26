import { AlertTriangle } from 'lucide-react';

export function ErrorState({ message }: { message: string }) {
  return (
    <section className="panel border-red-200 bg-red-50/30">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-800">
        <AlertTriangle className="h-4 w-4" />
        Couldn&apos;t fetch a recommendation
      </div>
      <p className="text-sm text-red-900/80">{message}</p>
    </section>
  );
}
