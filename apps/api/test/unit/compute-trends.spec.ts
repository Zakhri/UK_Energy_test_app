import { describe, expect, it } from 'vitest';

import { computeTrends } from '../../src/application/_lib/compute-trends.js';
import type { CarbonReading } from '../../src/domain/energy.js';

function reading(from: string, intensity: number, unreliable = false): CarbonReading {
  return {
    region: 'GB-LON',
    from,
    to: from,
    intensityGCo2PerKwh: intensity,
    index: 'moderate',
    kind: 'forecast',
    ...(unreliable ? { unreliable: true } : {}),
  };
}

describe('computeTrends', () => {
  it('returns null when today has no reliable readings', () => {
    const result = computeTrends([], [reading('2026-05-25T00:00Z', 150)]);
    expect(result).toBeNull();
  });

  it('returns null when history is empty', () => {
    const result = computeTrends([reading('2026-05-26T00:00Z', 150)], []);
    expect(result).toBeNull();
  });

  it('reports verdict=cleaner when today is meaningfully below the baseline', () => {
    const today = [reading('2026-05-26T00:00Z', 80), reading('2026-05-26T01:00Z', 90)];
    const history = [reading('2026-05-25T00:00Z', 200), reading('2026-05-24T00:00Z', 210)];
    const result = computeTrends(today, history);
    expect(result?.verdict).toBe('cleaner');
    expect(result?.deltaPct).toBeLessThan(0);
  });

  it('reports verdict=dirtier when today is meaningfully above the baseline', () => {
    const today = [reading('2026-05-26T00:00Z', 250), reading('2026-05-26T01:00Z', 260)];
    const history = [reading('2026-05-25T00:00Z', 100), reading('2026-05-24T00:00Z', 110)];
    const result = computeTrends(today, history);
    expect(result?.verdict).toBe('dirtier');
    expect(result?.deltaPct).toBeGreaterThan(0);
  });

  it('reports verdict=similar within ±5% delta', () => {
    const today = [reading('2026-05-26T00:00Z', 150)];
    const history = [reading('2026-05-25T00:00Z', 153)];
    const result = computeTrends(today, history);
    expect(result?.verdict).toBe('similar');
  });

  it('skips readings flagged unreliable', () => {
    const today = [reading('2026-05-26T00:00Z', 5, true), reading('2026-05-26T01:00Z', 150)];
    const history = [reading('2026-05-25T00:00Z', 150)];
    const result = computeTrends(today, history);
    expect(result?.todaySampleSize).toBe(1);
    expect(result?.todayAvgGCo2).toBe(150);
  });

  it('surfaces cleanest + dirtiest slots in today', () => {
    const today = [
      reading('2026-05-26T01:00Z', 200),
      reading('2026-05-26T13:00Z', 80),
      reading('2026-05-26T19:00Z', 260),
    ];
    const history = [reading('2026-05-25T00:00Z', 150)];
    const result = computeTrends(today, history);
    expect(result?.todayCleanestSlot.intensityGCo2PerKwh).toBe(80);
    expect(result?.todayDirtiestSlot.intensityGCo2PerKwh).toBe(260);
  });

  it('returns per-hour deltas where both sides have data', () => {
    const today = [reading('2026-05-26T08:00Z', 200), reading('2026-05-26T13:00Z', 100)];
    const history = [reading('2026-05-25T08:00Z', 150), reading('2026-05-24T13:00Z', 120)];
    const result = computeTrends(today, history);
    expect(result?.hourlyDelta[8]).toBe(50);
    expect(result?.hourlyDelta[13]).toBe(-20);
    expect(result?.hourlyDelta[0]).toBeNull();
  });
});
