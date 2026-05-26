import { Check, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ProgressStagesProps {
  readonly stages?: readonly string[];

  readonly stepMs?: number;

  readonly controlledIndex?: number;
}

const DEFAULT_STAGES = [
  'Fetching live grid data…',
  'Analyzing the next 24 hours…',
  'Cross-referencing your goal…',
  'Drafting recommendation…',
] as const;

export function ProgressStages({
  stages = DEFAULT_STAGES,
  stepMs = 750,
  controlledIndex,
}: ProgressStagesProps) {
  const [timerIndex, setTimerIndex] = useState(0);

  useEffect(() => {
    if (controlledIndex !== undefined) return;
    if (timerIndex >= stages.length - 1) return;
    const handle = setTimeout(() => setTimerIndex((prev) => prev + 1), stepMs);
    return () => clearTimeout(handle);
  }, [timerIndex, stages.length, stepMs, controlledIndex]);

  const activeIndex =
    controlledIndex !== undefined
      ? Math.max(0, Math.min(controlledIndex, stages.length - 1))
      : timerIndex;

  return (
    <ol className="space-y-2.5">
      {stages.map((label, index) => {
        const isDone = index < activeIndex;
        const isActive = index === activeIndex;
        const isPending = index > activeIndex;
        return (
          <li
            key={label}
            className={
              'flex items-center gap-2.5 text-[13px] transition-opacity duration-300 ' +
              (isPending ? 'opacity-30' : 'opacity-100')
            }
          >
            <span
              className={
                'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ' +
                (isDone
                  ? 'bg-emerald-600 text-white'
                  : isActive
                    ? 'bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200'
                    : 'bg-slate-100 text-slate-400')
              }
            >
              {isDone ? (
                <Check className="h-3 w-3" />
              ) : isActive ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <span className="font-mono text-[10px]">{index + 1}</span>
              )}
            </span>
            <span
              className={
                isActive
                  ? 'font-medium text-slate-800'
                  : isDone
                    ? 'text-slate-500 line-through'
                    : 'text-slate-500'
              }
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
