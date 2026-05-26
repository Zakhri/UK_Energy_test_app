export interface IntensityPalette {
  readonly border: string;
  readonly bg: string;
  readonly text: string;
  readonly dot: string;
}

export function paletteForLevel(level: string | null): IntensityPalette {
  switch (level) {
    case 'very low':
    case 'low':
      return {
        border: 'border-emerald-200',
        bg: 'bg-emerald-50',
        text: 'text-emerald-800',
        dot: 'bg-emerald-500',
      };
    case 'moderate':
      return {
        border: 'border-amber-200',
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        dot: 'bg-amber-500',
      };
    case 'high':
      return {
        border: 'border-orange-200',
        bg: 'bg-orange-50',
        text: 'text-orange-800',
        dot: 'bg-orange-500',
      };
    case 'very high':
      return {
        border: 'border-red-200',
        bg: 'bg-red-50',
        text: 'text-red-800',
        dot: 'bg-red-600',
      };
    default:
      return {
        border: 'border-slate-200',
        bg: 'bg-slate-50',
        text: 'text-slate-700',
        dot: 'bg-slate-400',
      };
  }
}
