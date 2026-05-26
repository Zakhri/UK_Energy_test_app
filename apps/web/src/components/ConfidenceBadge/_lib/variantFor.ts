import type { ConfidenceScoreDto } from '@uk-energy/shared';

export interface ConfidenceVariant {
  label: string;
  classes: string;
}

export function variantFor(
  recommendation: ConfidenceScoreDto['recommendation'],
): ConfidenceVariant {
  switch (recommendation) {
    case 'use_direct':
      return {
        label: 'High confidence',
        classes: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      };
    case 'use_with_caveat':
      return {
        label: 'Use with caveat',
        classes: 'border-amber-200 bg-amber-50 text-amber-800',
      };
    case 'ask_user':
      return {
        label: 'Verify first',
        classes: 'border-orange-200 bg-orange-50 text-orange-800',
      };
    case 'fallback_cache':
      return {
        label: 'Insufficient data',
        classes: 'border-red-200 bg-red-50 text-red-800',
      };
    default:
      return {
        label: 'Unknown',
        classes: 'border-slate-200 bg-white text-slate-700',
      };
  }
}
