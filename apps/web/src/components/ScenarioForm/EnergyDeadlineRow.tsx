import type { FieldErrors, UseFormRegister } from 'react-hook-form';

import type { ScenarioFormValues } from './_lib/formSchema.js';

interface EnergyDeadlineRowProps {
  register: UseFormRegister<ScenarioFormValues>;
  errors: FieldErrors<ScenarioFormValues>;
}

export function EnergyDeadlineRow({ register, errors }: EnergyDeadlineRowProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="kwh" className="field-label">
          Energy needed
        </label>
        <div className="relative">
          <input
            id="kwh"
            type="number"
            step="0.1"
            min="0.1"
            max="200"
            {...register('kwh')}
            className="input-base pr-12 font-mono tabular-nums"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium uppercase tracking-wider text-slate-400">
            kWh
          </span>
        </div>
        {errors.kwh ? <p className="mt-1 text-xs text-red-600">{errors.kwh.message}</p> : null}
      </div>
      <div>
        <label htmlFor="deadline" className="field-label">
          Deadline
        </label>
        <input
          id="deadline"
          type="datetime-local"
          {...register('deadline')}
          className="input-base"
        />
      </div>
    </div>
  );
}
