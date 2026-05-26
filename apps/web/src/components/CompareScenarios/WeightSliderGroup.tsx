import { Info } from 'lucide-react';

import type { CriteriaWeights } from './types.js';
import { WeightSlider } from './WeightSlider.js';

interface WeightSliderGroupProps {
  weights: CriteriaWeights;
  normalised: CriteriaWeights;
  onChange: (weights: CriteriaWeights) => void;
}

export function WeightSliderGroup({ weights, normalised, onChange }: WeightSliderGroupProps) {
  return (
    <div className="rounded-xl bg-surface-muted/60 p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500">
        <span>What matters most?</span>
        <span
          className="cursor-help text-slate-400"
          title="Drag freely — the sum doesn't have to be 1. The AI gets the normalised share (right column %)."
        >
          <Info className="h-3 w-3" />
        </span>
      </div>
      <p className="mb-2 text-[10px] leading-relaxed text-slate-500">
        Sliders are weights, not exact percentages. We rescale them so they always sum to 100%.
      </p>
      <div className="space-y-2">
        <WeightSlider
          label="Low carbon"
          value={weights.carbon}
          share={normalised.carbon}
          onChange={(value) => onChange({ ...weights, carbon: value })}
          accent="emerald"
        />
        <WeightSlider
          label="Low cost"
          value={weights.cost}
          share={normalised.cost}
          onChange={(value) => onChange({ ...weights, cost: value })}
          accent="amber"
        />
      </div>
    </div>
  );
}
