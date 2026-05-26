import { Check } from 'lucide-react';
import type { Control } from 'react-hook-form';
import { Controller } from 'react-hook-form';

import { cn } from '../../lib/cn.js';
import type { ScenarioFormValues } from './_lib/formSchema.js';
import { PREFERENCE_OPTIONS } from './_lib/options.js';

interface PreferenceChipGroupProps {
  control: Control<ScenarioFormValues>;
}

export function PreferenceChipGroup({ control }: PreferenceChipGroupProps) {
  return (
    <div>
      <label className="field-label">Optimise for</label>
      <Controller
        control={control}
        name="preferences"
        render={({ field }) => (
          <div className="flex flex-wrap gap-2">
            {PREFERENCE_OPTIONS.map((option) => {
              const selected = field.value.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    const next = selected
                      ? field.value.filter((flag) => flag !== option.value)
                      : [...field.value, option.value];
                    field.onChange(next);
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all duration-200',
                    selected
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800 shadow-soft'
                      : 'border-slate-200 bg-white text-slate-600 hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-900',
                  )}
                >
                  {selected ? (
                    <Check className="h-3 w-3" strokeWidth={3} />
                  ) : (
                    <option.Icon className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                  {option.label}
                </button>
              );
            })}
          </div>
        )}
      />
    </div>
  );
}
