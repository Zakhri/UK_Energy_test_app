export type UkRegionCode =
  | 'GB-NATIONAL'
  | 'GB-NORTH-SCOTLAND'
  | 'GB-SOUTH-SCOTLAND'
  | 'GB-NORTH-WEST-ENGLAND'
  | 'GB-NORTH-EAST-ENGLAND'
  | 'GB-YORKSHIRE'
  | 'GB-NORTH-WALES'
  | 'GB-SOUTH-WALES'
  | 'GB-WEST-MIDLANDS'
  | 'GB-EAST-MIDLANDS'
  | 'GB-EAST-ENGLAND'
  | 'GB-SOUTH-WEST-ENGLAND'
  | 'GB-SOUTH-ENGLAND'
  | 'GB-LON'
  | 'GB-SOUTH-EAST-ENGLAND';

export const UK_REGION_CODES: readonly UkRegionCode[] = [
  'GB-NATIONAL',
  'GB-NORTH-SCOTLAND',
  'GB-SOUTH-SCOTLAND',
  'GB-NORTH-WEST-ENGLAND',
  'GB-NORTH-EAST-ENGLAND',
  'GB-YORKSHIRE',
  'GB-NORTH-WALES',
  'GB-SOUTH-WALES',
  'GB-WEST-MIDLANDS',
  'GB-EAST-MIDLANDS',
  'GB-EAST-ENGLAND',
  'GB-SOUTH-WEST-ENGLAND',
  'GB-SOUTH-ENGLAND',
  'GB-LON',
  'GB-SOUTH-EAST-ENGLAND',
];

export const UK_REGION_COORDINATES: Record<UkRegionCode, { lat: number; lon: number }> = {
  'GB-NATIONAL': { lat: 54.7, lon: -2.3 },
  'GB-NORTH-SCOTLAND': { lat: 57.5, lon: -4.2 },
  'GB-SOUTH-SCOTLAND': { lat: 55.95, lon: -3.19 },
  'GB-NORTH-WEST-ENGLAND': { lat: 53.48, lon: -2.24 },
  'GB-NORTH-EAST-ENGLAND': { lat: 54.97, lon: -1.61 },
  'GB-YORKSHIRE': { lat: 53.96, lon: -1.08 },
  'GB-NORTH-WALES': { lat: 53.32, lon: -3.83 },
  'GB-SOUTH-WALES': { lat: 51.48, lon: -3.18 },
  'GB-WEST-MIDLANDS': { lat: 52.48, lon: -1.9 },
  'GB-EAST-MIDLANDS': { lat: 52.97, lon: -1.17 },
  'GB-EAST-ENGLAND': { lat: 52.2, lon: 0.13 },
  'GB-SOUTH-WEST-ENGLAND': { lat: 50.72, lon: -3.53 },
  'GB-SOUTH-ENGLAND': { lat: 50.9, lon: -1.4 },
  'GB-LON': { lat: 51.5074, lon: -0.1278 },
  'GB-SOUTH-EAST-ENGLAND': { lat: 51.27, lon: 0.52 },
};

export interface CarbonReading {
  readonly region: UkRegionCode;
  readonly from: string;
  readonly to: string;
  readonly intensityGCo2PerKwh: number;
  readonly index: CarbonIndexLevel;
  readonly kind: 'forecast' | 'actual';

  readonly unreliable?: boolean;
}

export type CarbonIndexLevel = 'very low' | 'low' | 'moderate' | 'high' | 'very high';

export interface CarbonForecast {
  readonly region: UkRegionCode;
  readonly fetchedAt: string;
  readonly readings: readonly CarbonReading[];
}

export interface WeatherSnapshot {
  readonly at: string;
  readonly temperatureCelsius: number;
  readonly cloudCoverPercent: number;
  readonly windSpeedMps: number;
  readonly precipitationMm: number;
}

export interface WeatherForecast {
  readonly region: UkRegionCode;
  readonly fetchedAt: string;
  readonly snapshots: readonly WeatherSnapshot[];
}

export interface DayAheadPricePoint {
  readonly from: string;
  readonly to: string;
  readonly pricePoundsPerMwh: number;
}

export interface DayAheadPriceCurve {
  readonly region: UkRegionCode;
  readonly fetchedAt: string;
  readonly source: 'entsoe' | 'synthetic';
  readonly currency: 'GBP';
  readonly prices: readonly DayAheadPricePoint[];
}
