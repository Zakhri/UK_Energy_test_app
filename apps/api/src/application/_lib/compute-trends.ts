import type { CarbonReading } from '../../domain/energy.js';

const SIMILAR_DELTA_PCT = 5;

export interface TrendSummary {
  readonly todayAvgGCo2: number;

  readonly weekAvgGCo2: number;

  readonly deltaPct: number;

  readonly verdict: 'cleaner' | 'similar' | 'dirtier';

  readonly todayCleanestSlot: { readonly from: string; readonly intensityGCo2PerKwh: number };

  readonly todayDirtiestSlot: { readonly from: string; readonly intensityGCo2PerKwh: number };

  readonly todaySampleSize: number;
  readonly weekSampleSize: number;

  readonly hourlyDelta: ReadonlyArray<number | null>;
}

export function computeTrends(
  todayReadings: readonly CarbonReading[],
  historyReadings: readonly CarbonReading[],
): TrendSummary | null {
  const today = todayReadings.filter((reading) => !reading.unreliable);
  const history = historyReadings.filter((reading) => !reading.unreliable);
  if (today.length === 0 || history.length === 0) return null;

  const todayAvgGCo2 = round(mean(today.map((r) => r.intensityGCo2PerKwh)), 1);
  const weekAvgGCo2 = round(mean(history.map((r) => r.intensityGCo2PerKwh)), 1);
  const deltaPct =
    weekAvgGCo2 < 1 ? 0 : round(((todayAvgGCo2 - weekAvgGCo2) / weekAvgGCo2) * 100, 1);

  const verdict: TrendSummary['verdict'] =
    Math.abs(deltaPct) < SIMILAR_DELTA_PCT ? 'similar' : deltaPct > 0 ? 'dirtier' : 'cleaner';

  const todayCleanest = pickExtreme(today, 'min');
  const todayDirtiest = pickExtreme(today, 'max');

  return {
    todayAvgGCo2,
    weekAvgGCo2,
    deltaPct,
    verdict,
    todayCleanestSlot: {
      from: todayCleanest.from,
      intensityGCo2PerKwh: todayCleanest.intensityGCo2PerKwh,
    },
    todayDirtiestSlot: {
      from: todayDirtiest.from,
      intensityGCo2PerKwh: todayDirtiest.intensityGCo2PerKwh,
    },
    todaySampleSize: today.length,
    weekSampleSize: history.length,
    hourlyDelta: computeHourlyDelta(today, history),
  };
}

function computeHourlyDelta(
  today: readonly CarbonReading[],
  history: readonly CarbonReading[],
): ReadonlyArray<number | null> {
  const todayByHour = groupByHourOfDay(today);
  const historyByHour = groupByHourOfDay(history);
  return Array.from({ length: 24 }, (_, hour) => {
    const t = todayByHour[hour];
    const h = historyByHour[hour];
    if (!t || !h || t.length === 0 || h.length === 0) return null;
    return round(mean(t) - mean(h), 1);
  });
}

function groupByHourOfDay(readings: readonly CarbonReading[]): Record<number, number[]> {
  const buckets: Record<number, number[]> = {};
  for (const reading of readings) {
    const hour = new Date(reading.from).getUTCHours();
    if (!buckets[hour]) buckets[hour] = [];
    buckets[hour]!.push(reading.intensityGCo2PerKwh);
  }
  return buckets;
}

function pickExtreme(readings: readonly CarbonReading[], mode: 'min' | 'max'): CarbonReading {
  return readings.reduce((acc, current) => {
    if (mode === 'min') {
      return current.intensityGCo2PerKwh < acc.intensityGCo2PerKwh ? current : acc;
    }
    return current.intensityGCo2PerKwh > acc.intensityGCo2PerKwh ? current : acc;
  });
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
