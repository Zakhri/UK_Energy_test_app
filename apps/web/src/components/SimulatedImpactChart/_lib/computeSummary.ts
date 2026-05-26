import type { ImpactPoint } from './types.js';

export interface ImpactSummary {
  readonly min: ImpactPoint;

  readonly max: ImpactPoint;

  readonly avgKg: number;

  readonly vsAvgPct: number;

  readonly vsWorstPct: number;

  readonly bestIntensity: number;

  readonly unreliableCount: number;
}

export function computeSummary(points: readonly ImpactPoint[], kwh: number): ImpactSummary | null {
  if (points.length === 0) return null;
  const unreliableCount = points.filter((point) => point.unreliable).length;
  const reliable = points.filter((point) => !point.unreliable);
  if (reliable.length === 0) return null;

  const min = reliable.reduce((best, point) => (point.kgCo2 < best.kgCo2 ? point : best));
  const max = reliable.reduce((worst, point) => (point.kgCo2 > worst.kgCo2 ? point : worst));
  const avgIntensity = reliable.reduce((sum, point) => sum + point.intensity, 0) / reliable.length;
  const avgKg = (avgIntensity * kwh) / 1000;
  const vsAvgPct = avgKg > 0 ? Math.round((1 - min.kgCo2 / avgKg) * 100) : 0;
  const vsWorstPct = max.kgCo2 > 0 ? Math.round((1 - min.kgCo2 / max.kgCo2) * 100) : 0;
  return {
    min,
    max,
    avgKg,
    vsAvgPct,
    vsWorstPct,
    bestIntensity: min.intensity,
    unreliableCount,
  };
}
