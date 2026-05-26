import { describe, expect, it } from 'vitest';

import { findOptimalWindows } from '../../src/application/_lib/find-optimal-windows.js';

function carbonSeries(
  intensities: readonly number[],
  startIso = '2026-05-26T00:00Z',
): { from: string; intensityGCo2PerKwh: number }[] {
  const startMs = Date.parse(startIso);
  return intensities.map((intensity, index) => ({
    from: new Date(startMs + index * 30 * 60_000).toISOString(),
    intensityGCo2PerKwh: intensity,
  }));
}

function priceSeries(
  prices: readonly number[],
  startIso = '2026-05-26T00:00Z',
): { from: string; pricePoundsPerMwh: number }[] {
  const startMs = Date.parse(startIso);
  return prices.map((price, index) => ({
    from: new Date(startMs + index * 30 * 60_000).toISOString(),
    pricePoundsPerMwh: price,
  }));
}

const FAR_FUTURE_NOW = Date.parse('2025-01-01T00:00Z');

describe('findOptimalWindows', () => {
  it('returns empty when not enough reliable readings cover the duration', () => {
    const result = findOptimalWindows({
      carbon: carbonSeries([100, 110]),
      preferences: ['low-carbon'],
      durationHours: 6,
      nowMs: FAR_FUTURE_NOW,
    });
    expect(result).toEqual([]);
  });

  it('picks the lowest-avg 6h window across a varying series (the bug Gemini failed on)', () => {
    const intensities = [
      169, 160, 158, 164, 164, 170, 166, 169, 179, 174, 171, 186, 196, 200, 204, 204, 206, 207, 199,
      191, 181, 165, 146, 147, 147, 144, 142, 144, 140, 140, 135, 135, 133, 136, 139, 144, 150, 161,
      173, 185, 197, 204, 215, 218, 222, 217, 214, 210,
    ];
    const result = findOptimalWindows({
      carbon: carbonSeries(intensities, '2026-05-25T22:00Z'),
      preferences: ['low-carbon'],
      durationHours: 6,
      nowMs: Date.parse('2026-05-25T22:00Z'),
    });

    expect(result).toHaveLength(3);
    expect(result[0]?.priority).toBe(1);
    expect(result[0]?.avgCarbonGCo2).toBeLessThan(result[1]!.avgCarbonGCo2 + 0.01);
    expect(result[1]?.avgCarbonGCo2).toBeLessThan(result[2]!.avgCarbonGCo2 + 0.01);

    expect(result[0]?.windowStart).toBe('2026-05-26T10:00:00.000Z');
    expect(result[0]?.windowEnd).toBe('2026-05-26T16:00:00.000Z');
    expect(result[0]?.avgCarbonGCo2).toBeCloseTo(139.9, 0);
  });

  it('honours the deadline — never returns a window ending past it', () => {
    const intensities = [200, 200, 200, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100];
    const result = findOptimalWindows({
      carbon: carbonSeries(intensities),
      preferences: ['low-carbon'],
      durationHours: 3,
      deadline: '2026-05-26T03:00Z',
      nowMs: FAR_FUTURE_NOW,
    });

    expect(result.length).toBeGreaterThan(0);
    for (const window of result) {
      expect(Date.parse(window.windowEnd)).toBeLessThanOrEqual(
        Date.parse('2026-05-26T03:00Z') + 30 * 60_000,
      );
    }
  });

  it('skips windows starting before now', () => {
    const intensities = [50, 50, 50, 50, 200, 200, 200, 200];
    const result = findOptimalWindows({
      carbon: carbonSeries(intensities),
      preferences: ['low-carbon'],
      durationHours: 2,

      nowMs: Date.parse('2026-05-26T02:00Z'),
    });

    expect(result.length).toBeGreaterThan(0);
    for (const window of result) {
      expect(Date.parse(window.windowStart)).toBeGreaterThanOrEqual(
        Date.parse('2026-05-26T02:00Z') - 15 * 60_000,
      );
    }
  });

  it('filters out readings flagged unreliable', () => {
    const series = carbonSeries([200, 200, 200, 200, 200, 200]);

    const withSpike = [
      ...series.slice(0, 3),
      { from: '2026-05-26T01:30Z', intensityGCo2PerKwh: 5, unreliable: true },
      ...series.slice(4),
    ];
    const result = findOptimalWindows({
      carbon: withSpike,
      preferences: ['low-carbon'],
      durationHours: 1,
      nowMs: FAR_FUTURE_NOW,
    });

    for (const window of result) {
      expect(window.avgCarbonGCo2).toBe(200);
    }
  });

  it('penalises windows overlapping UK peak (UTC 16:00–20:00) with avoid-peak preference', () => {
    const intensities = Array.from({ length: 24 }, () => 150);
    const result = findOptimalWindows({
      carbon: carbonSeries(intensities),
      preferences: ['avoid-peak'],
      durationHours: 2,
      nowMs: FAR_FUTURE_NOW,
    });

    const longSeries = Array.from({ length: 48 }, () => 150);
    const peakResult = findOptimalWindows({
      carbon: carbonSeries(longSeries),
      preferences: ['avoid-peak'],
      durationHours: 2,
      nowMs: FAR_FUTURE_NOW,
    });

    for (const window of peakResult) {
      const startHour = new Date(window.windowStart).getUTCHours();
      expect(startHour < 16 || startHour >= 20).toBe(true);
    }

    expect(result.length).toBeGreaterThan(0);
  });

  it('combines multiple preferences (low-carbon + low-price)', () => {
    const result = findOptimalWindows({
      carbon: carbonSeries([100, 100, 200, 200, 100, 100]),
      prices: priceSeries([80, 80, 80, 80, 30, 30]),
      preferences: ['low-carbon', 'low-price'],
      durationHours: 1,
      nowMs: FAR_FUTURE_NOW,
    });

    expect(result[0]?.windowStart).toBe('2026-05-26T02:00:00.000Z');
  });

  it('deduplicates overlapping candidates — top 3 are distinct windows', () => {
    const intensities = [200, 200, 200, 100, 100, 100, 100, 100, 100, 200, 200, 200];
    const result = findOptimalWindows({
      carbon: carbonSeries(intensities),
      preferences: ['low-carbon'],
      durationHours: 1.5,
      nowMs: FAR_FUTURE_NOW,
    });

    expect(result.length).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < result.length - 1; i++) {
      const a = result[i]!;
      const b = result[i + 1]!;
      const aStart = Date.parse(a.windowStart);
      const aEnd = Date.parse(a.windowEnd);
      const bStart = Date.parse(b.windowStart);
      const bEnd = Date.parse(b.windowEnd);
      const overlap = Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
      const shorter = Math.min(aEnd - aStart, bEnd - bStart);
      expect(overlap / shorter).toBeLessThanOrEqual(0.5);
    }
  });

  it('expresses avgCostPounds in £/kWh (divides £/MWh by 1000)', () => {
    const result = findOptimalWindows({
      carbon: carbonSeries([100, 100]),
      prices: priceSeries([50, 50]),
      preferences: ['low-price'],
      durationHours: 1,
      nowMs: FAR_FUTURE_NOW,
    });
    expect(result[0]?.avgCostPounds).toBeCloseTo(0.05, 3);
  });

  it('returns undefined avgCostPounds when no price series supplied', () => {
    const result = findOptimalWindows({
      carbon: carbonSeries([100, 100]),
      preferences: ['low-carbon'],
      durationHours: 1,
      nowMs: FAR_FUTURE_NOW,
    });
    expect(result[0]?.avgCostPounds).toBeUndefined();
  });

  it('defaults to low-carbon scoring when no preferences supplied', () => {
    const result = findOptimalWindows({
      carbon: carbonSeries([200, 200, 100, 100, 200, 200]),
      preferences: [],
      durationHours: 1,
      nowMs: FAR_FUTURE_NOW,
    });
    expect(result[0]?.windowStart).toBe('2026-05-26T01:00:00.000Z');
  });

  it('assigns priority 1, 2, 3 in score-descending order', () => {
    const result = findOptimalWindows({
      carbon: carbonSeries([100, 100, 200, 200, 150, 150, 120, 120, 180, 180]),
      preferences: ['low-carbon'],
      durationHours: 1,
      nowMs: FAR_FUTURE_NOW,
    });
    expect(result.map((window) => window.priority)).toEqual([1, 2, 3]);
    expect(result.map((window) => window.id)).toEqual(['w1', 'w2', 'w3']);
  });
});
