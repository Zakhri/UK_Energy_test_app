import type { RegionCode } from '@uk-energy/shared';

import { useSignals } from './useSignals.js';

export function useCurrentIntensity(region: RegionCode): number | null {
  const { data } = useSignals('carbon', region);
  if (!data) return null;

  const nowMs = Date.now();
  const current = data.signals.find(
    (
      signal,
    ): signal is {
      from: string;
      to: string;
      intensityGCo2PerKwh: number;
      index: string;
      kind: 'forecast' | 'actual';
      unreliable?: boolean;
    } =>
      'intensityGCo2PerKwh' in signal &&
      !signal.unreliable &&
      Math.abs(new Date(signal.from).getTime() - nowMs) < 90 * 60_000,
  );

  return current ? current.intensityGCo2PerKwh : null;
}
