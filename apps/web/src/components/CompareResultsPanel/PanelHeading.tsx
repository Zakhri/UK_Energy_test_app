import { Scale } from 'lucide-react';

export function PanelHeading() {
  return (
    <div className="panel-heading">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <Scale className="h-4 w-4" />
        </div>
        <div>
          <h2 className="panel-title">Ranked windows</h2>
          <p className="panel-subtitle">AI ranking of your compare candidates</p>
        </div>
      </div>
    </div>
  );
}
