import { Plus, Scale, Trophy, Wand2 } from 'lucide-react';
import { useMemo } from 'react';
import type { AdviceGoalCode, CompareBody, RegionCode } from '@uk-energy/shared';

import { ScenarioRowEditor } from './ScenarioRowEditor.js';
import { WeightSliderGroup } from './WeightSliderGroup.js';
import { DEFAULT_KWH } from './_lib/starterScenarios.js';
import { toIso } from './_lib/toIso.js';
import type { CriteriaWeights, ScenarioRow } from './types.js';

const DEFAULT_GOAL: AdviceGoalCode = 'ev-charge';

interface CompareScenariosProps {
  region: RegionCode;
  scenarios: ScenarioRow[];
  onScenariosChange: (scenarios: ScenarioRow[]) => void;
  weights: CriteriaWeights;
  onWeightsChange: (weights: CriteriaWeights) => void;
  onSubmit: (body: CompareBody) => void;
  isPending: boolean;
}

export function CompareScenarios({
  region,
  scenarios,
  onScenariosChange,
  weights,
  onWeightsChange,
  onSubmit,
  isPending,
}: CompareScenariosProps) {
  const totalWeight = weights.carbon + weights.cost + weights.speed;
  const weightsValid = totalWeight > 0;

  const normalisedWeights = useMemo<CriteriaWeights>(() => {
    if (!weightsValid) return { carbon: 0, cost: 0, speed: 0 };
    return {
      carbon: weights.carbon / totalWeight,
      cost: weights.cost / totalWeight,
      speed: weights.speed / totalWeight,
    };
  }, [weights, totalWeight, weightsValid]);

  const canSubmit = scenarios.length >= 2 && scenarios.length <= 6 && weightsValid && !isPending;

  const handleAddRow = () => {
    if (scenarios.length >= 6) return;
    const next = scenarios.length + 1;
    onScenariosChange([
      ...scenarios,
      {
        id: `slot-${next}`,
        label: `Window ${next}`,
        windowStart: scenarios[0]?.windowStart ?? '',
        windowEnd: scenarios[0]?.windowEnd ?? '',
        kwh: DEFAULT_KWH,
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (scenarios.length <= 2) return;
    onScenariosChange(scenarios.filter((_, slotIndex) => slotIndex !== index));
  };

  const handleScenarioChange = (index: number, patch: Partial<ScenarioRow>) => {
    onScenariosChange(
      scenarios.map((scenario, slotIndex) =>
        slotIndex === index ? { ...scenario, ...patch } : scenario,
      ),
    );
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      region,
      scenarios: scenarios.map((scenario) => ({
        id: scenario.id,
        label: scenario.label,
        windowStart: toIso(scenario.windowStart),
        windowEnd: toIso(scenario.windowEnd),
        kwh: scenario.kwh,
      })),
      criteria: { goal: DEFAULT_GOAL, weights: normalisedWeights },
    });
  };

  return (
    <section className="panel flex h-full min-h-0 flex-col overflow-hidden transition-shadow hover:shadow-lift">
      <div className="panel-heading shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Scale className="h-4 w-4" />
          </div>
          <div>
            <h2 className="panel-title">Compare specific windows</h2>
            <p className="panel-subtitle">2–6 windows, weight what matters, AI ranks them</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 min-h-0 flex-col gap-4">
        <div className="flex-1 min-h-0 space-y-2.5 overflow-y-auto pr-1 scroll-area-quiet">
          {scenarios.map((scenario, index) => (
            <ScenarioRowEditor
              key={scenario.id}
              scenario={scenario}
              index={index}
              canRemove={scenarios.length > 2}
              onChange={(patch) => handleScenarioChange(index, patch)}
              onRemove={() => handleRemoveRow(index)}
            />
          ))}
          {scenarios.length < 6 ? (
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50/40 hover:text-emerald-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add another window
            </button>
          ) : null}
        </div>

        <WeightSliderGroup
          weights={weights}
          normalised={normalisedWeights}
          onChange={onWeightsChange}
        />

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:bg-emerald-600 hover:shadow-lift disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          {isPending ? (
            <>
              <Wand2 className="h-4 w-4 animate-soft-bounce" /> Ranking…
            </>
          ) : (
            <>
              <Trophy className="h-4 w-4" /> Rank windows
            </>
          )}
        </button>
      </form>
    </section>
  );
}

// Re-exports so consumers can `import { ScenarioRow, ... } from 'components/CompareScenarios'`
export type { CriteriaWeights, ScenarioRow } from './types.js';
export { DEFAULT_WEIGHTS, buildStarterScenarios } from './_lib/starterScenarios.js';
