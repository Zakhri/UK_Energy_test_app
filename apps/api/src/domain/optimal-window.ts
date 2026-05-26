export interface OptimalWindow {
  readonly id: string;
  readonly windowStart: string;
  readonly windowEnd: string;

  readonly avgCarbonGCo2: number;

  readonly avgCostPounds: number | undefined;

  readonly score: number;

  readonly priority: number;
}
