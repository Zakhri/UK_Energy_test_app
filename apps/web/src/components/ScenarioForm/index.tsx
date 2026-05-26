import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Settings2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { RegionCode } from '@uk-energy/shared';

import { defaultDeadline } from './_lib/defaultDeadline.js';
import { formSchema, type ScenarioFormValues } from './_lib/formSchema.js';
import { EnergyDeadlineRow } from './EnergyDeadlineRow.js';
import { GoalTileGroup } from './GoalTileGroup.js';
import { LoadingDots } from './LoadingDots.js';
import { PreferenceChipGroup } from './PreferenceChipGroup.js';

interface ScenarioFormProps {
  region: RegionCode;
  submitting: boolean;
  onSubmit: (values: ScenarioFormValues) => void;
}

export function ScenarioForm({ region, submitting, onSubmit }: ScenarioFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    watch,
  } = useForm<ScenarioFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      goal: 'ev-charge',
      kwh: 40,
      deadline: defaultDeadline(),
      preferences: ['low-carbon', 'avoid-peak'],
    },
  });

  const currentGoal = watch('goal');

  return (
    <form
      onSubmit={handleSubmit((values) => {
        const submission: ScenarioFormValues = {
          ...values,
          deadline: values.deadline ? new Date(values.deadline).toISOString() : undefined,
        };
        onSubmit(submission);
      })}
      className="panel space-y-5"
      aria-label={`Plan energy use for ${region}`}
    >
      <div className="panel-heading">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Settings2 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="panel-title">Your plan</h2>
            <p className="panel-subtitle">Tell us what you need and when</p>
          </div>
        </div>
      </div>

      <GoalTileGroup currentGoal={currentGoal} register={register} />
      <EnergyDeadlineRow register={register} errors={errors} />
      <PreferenceChipGroup control={control} />

      <button type="submit" disabled={submitting} className="btn-primary group w-full">
        {submitting ? (
          <>
            <LoadingDots />
            <span>Finding the best window…</span>
          </>
        ) : (
          <>
            <span>Show me the best window</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </button>
    </form>
  );
}

// Re-export so `import type { ScenarioFormValues } from 'components/ScenarioForm'` works.
export type { ScenarioFormValues } from './_lib/formSchema.js';
