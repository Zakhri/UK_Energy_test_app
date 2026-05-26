import type { RankedScenario, ScenarioCriteria, ScenarioInput } from '../../domain/advice.js';
import type { CarbonReading, DayAheadPricePoint } from '../../domain/energy.js';

const SLOT_MINUTES = 30;

export interface ScoreScenariosInput {
  readonly scenarios: readonly ScenarioInput[];
  readonly criteria: ScenarioCriteria;
  readonly carbon: readonly CarbonReading[];
  readonly prices: readonly DayAheadPricePoint[];
}

export function scoreScenarios(input: ScoreScenariosInput): readonly RankedScenario[] {
  if (input.scenarios.length === 0) return [];

  const enriched = input.scenarios.map((scenario) => {
    const startMs = Date.parse(scenario.windowStart);
    const endMs = Date.parse(scenario.windowEnd);
    const durationMs = Math.max(0, endMs - startMs);

    const avgCarbon = averageWithin(input.carbon, startMs, endMs, (reading) => ({
      slotStartMs: Date.parse(reading.from),
      value: reading.intensityGCo2PerKwh,
    }));
    const avgPriceMwh = averageWithin(input.prices, startMs, endMs, (point) => ({
      slotStartMs: Date.parse(point.from),
      value: point.pricePoundsPerMwh,
    }));

    return {
      scenario,
      durationMs,
      avgCarbon: avgCarbon ?? 0,
      avgCostPounds: avgPriceMwh !== undefined ? round(avgPriceMwh / 1000, 4) : undefined,
    };
  });

  const carbons = enriched.map((entry) => entry.avgCarbon);
  const carbonsMin = Math.min(...carbons);
  const carbonsMax = Math.max(...carbons);

  const priceValues = enriched
    .map((entry) => entry.avgCostPounds)
    .filter((price): price is number => price !== undefined);
  const priceMin = priceValues.length > 0 ? Math.min(...priceValues) : 0;
  const priceMax = priceValues.length > 0 ? Math.max(...priceValues) : 1;

  const durations = enriched.map((entry) => entry.durationMs);
  const durationMin = Math.min(...durations);
  const durationMax = Math.max(...durations);

  const totalWeight =
    input.criteria.weights.carbon + input.criteria.weights.cost + input.criteria.weights.speed;

  const safeTotal = totalWeight > 0 ? totalWeight : 3;

  const ranked = enriched.map((entry) => {
    const carbonScore = invertNormalised(entry.avgCarbon, carbonsMin, carbonsMax);
    const priceScore =
      entry.avgCostPounds !== undefined
        ? invertNormalised(entry.avgCostPounds, priceMin, priceMax)
        : 0.5;
    const speedScore = invertNormalised(entry.durationMs, durationMin, durationMax);

    const blended =
      (carbonScore * input.criteria.weights.carbon +
        priceScore * input.criteria.weights.cost +
        speedScore * input.criteria.weights.speed) /
      safeTotal;

    return {
      scenarioId: entry.scenario.id,
      score: round(blended, 3),
      rationale: '',
      expectedCarbonGCo2: round(entry.avgCarbon, 1),
      ...(entry.avgCostPounds !== undefined ? { expectedCostPounds: entry.avgCostPounds } : {}),
    } satisfies RankedScenario;
  });

  return [...ranked].sort((a, b) => b.score - a.score);
}

function averageWithin<T>(
  series: readonly T[],
  windowStartMs: number,
  windowEndMs: number,
  project: (item: T) => { slotStartMs: number; value: number },
): number | undefined {
  const matched: number[] = [];
  for (const item of series) {
    const { slotStartMs, value } = project(item);
    if (!Number.isFinite(slotStartMs)) continue;
    const slotEndMs = slotStartMs + SLOT_MINUTES * 60_000;
    if (slotEndMs <= windowStartMs || slotStartMs >= windowEndMs) continue;
    matched.push(value);
  }
  if (matched.length === 0) return undefined;
  return matched.reduce((sum, value) => sum + value, 0) / matched.length;
}

function invertNormalised(value: number, min: number, max: number): number {
  if (max - min < 1e-9) return 1;
  return 1 - (value - min) / (max - min);
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
