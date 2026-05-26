import type { UseFormRegister } from 'react-hook-form';
import type { AdviceGoalCode } from '@uk-energy/shared';

import { cn } from '../../lib/cn.js';
import { GOAL_OPTIONS } from './_lib/options.js';
import type { ScenarioFormValues } from './_lib/formSchema.js';

interface GoalTileGroupProps {
  currentGoal: AdviceGoalCode;

  register: UseFormRegister<ScenarioFormValues>;
}

export function GoalTileGroup({ currentGoal, register }: GoalTileGroupProps) {
  return (
    <div>
      <label className="field-label">What are you running?</label>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Goal">
        {GOAL_OPTIONS.map((option) => {
          const active = currentGoal === option.value;
          return (
            <label
              key={option.value}
              className={cn('group pill-tile', active ? 'pill-tile--active' : 'pill-tile--idle')}
            >
              <input type="radio" value={option.value} {...register('goal')} className="sr-only" />
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 group-hover:scale-105',
                  active
                    ? 'bg-emerald-100 text-emerald-700 shadow-soft'
                    : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700',
                )}
              >
                <option.Icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <span className="font-medium leading-tight">{option.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
