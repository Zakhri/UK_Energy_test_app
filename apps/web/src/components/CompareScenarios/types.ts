export interface ScenarioRow {
  id: string;
  label: string;

  windowStart: string;
  windowEnd: string;
  kwh: number;
}

export interface CriteriaWeights {
  carbon: number;
  cost: number;
  speed: number;
}
