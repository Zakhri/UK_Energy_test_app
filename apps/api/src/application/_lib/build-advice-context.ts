import type {
  CarbonForecast,
  CarbonReading,
  DayAheadPriceCurve,
  DayAheadPricePoint,
  UkRegionCode,
  WeatherForecast,
  WeatherSnapshot,
} from '../../domain/energy.js';
import type { CacheRepository } from '../../infra/cache/index.js';
import { withCache } from '../../infra/cache/index.js';
import type { CarbonIntensityClient } from '../../infra/clients/carbon-intensity.client.js';
import type { EntsoeClient } from '../../infra/clients/entsoe.client.js';
import type { OpenMeteoClient } from '../../infra/clients/open-meteo.client.js';

const CONTEXT_WINDOW_POINTS = 96;

const CARBON_TTL_SECONDS = 30 * 60;
const CARBON_STALE_SECONDS = 6 * 3600;
const WEATHER_TTL_SECONDS = 60 * 60;
const WEATHER_STALE_SECONDS = 12 * 3600;
const PRICES_TTL_SECONDS = 60 * 60;
const PRICES_STALE_SECONDS = 24 * 3600;

export interface BuildAdviceContextDeps {
  readonly cache: CacheRepository;
  readonly carbonClient: CarbonIntensityClient;
  readonly weatherClient: OpenMeteoClient;
  readonly entsoeClient: EntsoeClient;
}

export interface BuildAdviceContextResult {
  readonly carbon: readonly CarbonReading[];
  readonly weather: readonly WeatherSnapshot[];
  readonly prices: readonly DayAheadPricePoint[];
  readonly priceSource: 'entsoe' | 'synthetic';
  readonly oldestDataAgeMinutes: number;
  readonly unreliableCarbonCount: number;
}

export async function buildAdviceContext(
  deps: BuildAdviceContextDeps,
  region: UkRegionCode,
): Promise<BuildAdviceContextResult> {
  const [carbonResult, weatherResult, priceResult] = await Promise.all([
    withCache<CarbonForecast>(
      deps.cache,
      { pk: `SRC#carbon-intensity#${region}`, sk: 'fw48h' },
      async () => deps.carbonClient.fetch24hForecast(region),
      { ttlSeconds: CARBON_TTL_SECONDS, maxStaleSeconds: CARBON_STALE_SECONDS },
    ),
    withCache<WeatherForecast>(
      deps.cache,
      { pk: `SRC#open-meteo#${region}`, sk: 'fw48h' },
      async () => deps.weatherClient.fetch48hForecast(region),
      { ttlSeconds: WEATHER_TTL_SECONDS, maxStaleSeconds: WEATHER_STALE_SECONDS },
    ),
    withCache<DayAheadPriceCurve>(
      deps.cache,
      { pk: `SRC#entsoe#${region}`, sk: 'dayAhead' },
      async () => deps.entsoeClient.fetchDayAheadPrices(region),
      { ttlSeconds: PRICES_TTL_SECONDS, maxStaleSeconds: PRICES_STALE_SECONDS },
    ),
  ]);

  const carbon = carbonResult.value;
  const weather = weatherResult.value;
  const price = priceResult.value;

  const oldestFetchedAt = Math.min(
    new Date(carbon.fetchedAt).getTime(),
    new Date(weather.fetchedAt).getTime(),
    new Date(price.fetchedAt).getTime(),
  );
  const oldestDataAgeMinutes = Math.max(0, (Date.now() - oldestFetchedAt) / 60_000);

  const carbonSlice = carbon.readings.slice(0, CONTEXT_WINDOW_POINTS);
  const weatherSlice = weather.snapshots.slice(0, CONTEXT_WINDOW_POINTS);
  const priceSlice = price.prices.slice(0, CONTEXT_WINDOW_POINTS);

  const unreliableCarbonCount = carbonSlice.filter((reading) => reading.unreliable).length;

  return {
    carbon: carbonSlice,
    weather: weatherSlice,
    prices: priceSlice,
    priceSource: price.source,
    oldestDataAgeMinutes,
    unreliableCarbonCount,
  };
}
