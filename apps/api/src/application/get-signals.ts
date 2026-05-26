import type {
  CarbonSignalPoint,
  PriceSignalPoint,
  SignalsResponse,
  WeatherSignalPoint,
} from '@uk-energy/shared';
import type { RegionCode, SignalsQuery } from '@uk-energy/shared';

import type { UkRegionCode } from '../domain/energy.js';
import { ValidationError } from '../domain/errors.js';
import type { CacheRepository } from '../infra/cache/index.js';
import { withCache } from '../infra/cache/index.js';
import type { CarbonIntensityClient } from '../infra/clients/carbon-intensity.client.js';
import type { EntsoeClient } from '../infra/clients/entsoe.client.js';
import type { OpenMeteoClient } from '../infra/clients/open-meteo.client.js';
import { floorToBucket } from '../infra/_lib/time.js';

export interface GetSignalsDeps {
  readonly cache: CacheRepository;
  readonly carbonClient: CarbonIntensityClient;
  readonly weatherClient: OpenMeteoClient;
  readonly entsoeClient: EntsoeClient;
}

export type SignalCategory = 'carbon' | 'weather' | 'price';

export interface GetSignalsInput {
  readonly category: SignalCategory;
  readonly query: SignalsQuery;
  readonly requestId: string;
}

export async function getSignals(
  deps: GetSignalsDeps,
  input: GetSignalsInput,
): Promise<SignalsResponse> {
  const region = input.query.region;
  switch (input.category) {
    case 'carbon':
      return getCarbonSignal(deps, region, input.requestId);
    case 'weather':
      return getWeatherSignal(deps, region, input.requestId);
    case 'price':
      return getPriceSignal(deps, region, input.requestId);
    default:
      throw new ValidationError(`Unsupported signal category: ${String(input.category)}`);
  }
}

async function getCarbonSignal(
  deps: GetSignalsDeps,
  region: RegionCode,
  requestId: string,
): Promise<SignalsResponse> {
  const key = cacheKeyFor('carbon', region);
  const result = await withCache(
    deps.cache,
    key,
    async () => deps.carbonClient.fetch24hForecast(region as UkRegionCode),
    { ttlSeconds: 30 * 60, maxStaleSeconds: 6 * 3600 },
  );

  const signals: readonly CarbonSignalPoint[] = result.value.readings.map((reading) => ({
    from: reading.from,
    to: reading.to,
    intensityGCo2PerKwh: reading.intensityGCo2PerKwh,
    index: reading.index,
    kind: reading.kind,
    // Forwarded so the SimulatedImpactChart can hatch-fill these bars
    // and the stats panel can skip them from "best window" calcs.
    ...(reading.unreliable ? { unreliable: true } : {}),
  }));

  return {
    category: 'carbon',
    region,
    source: 'carbonintensity.org.uk',
    updatedAt: result.value.fetchedAt,
    signals,
    meta: buildMeta(requestId, result),
  };
}

async function getWeatherSignal(
  deps: GetSignalsDeps,
  region: RegionCode,
  requestId: string,
): Promise<SignalsResponse> {
  const key = cacheKeyFor('weather', region);
  const result = await withCache(
    deps.cache,
    key,
    async () => deps.weatherClient.fetch48hForecast(region as UkRegionCode),
    { ttlSeconds: 60 * 60, maxStaleSeconds: 12 * 3600 },
  );

  const signals: readonly WeatherSignalPoint[] = result.value.snapshots.map((snap) => ({
    at: snap.at,
    temperatureCelsius: snap.temperatureCelsius,
    cloudCoverPercent: snap.cloudCoverPercent,
    windSpeedMps: snap.windSpeedMps,
    precipitationMm: snap.precipitationMm,
  }));

  return {
    category: 'weather',
    region,
    source: 'open-meteo.com',
    updatedAt: result.value.fetchedAt,
    signals,
    meta: buildMeta(requestId, result),
  };
}

async function getPriceSignal(
  deps: GetSignalsDeps,
  region: RegionCode,
  requestId: string,
): Promise<SignalsResponse> {
  const key = cacheKeyFor('price', region);
  const result = await withCache(
    deps.cache,
    key,
    async () => deps.entsoeClient.fetchDayAheadPrices(region as UkRegionCode),
    { ttlSeconds: 60 * 60, maxStaleSeconds: 24 * 3600 },
  );

  const signals: readonly PriceSignalPoint[] = result.value.prices.map((point) => ({
    from: point.from,
    to: point.to,
    pricePoundsPerMwh: point.pricePoundsPerMwh,
  }));

  return {
    category: 'price',
    region,
    source: result.value.source === 'synthetic' ? 'synthetic (ENTSO-E unavailable)' : 'entsoe',
    updatedAt: result.value.fetchedAt,
    signals,
    meta: {
      ...buildMeta(requestId, result),
      degraded: result.value.source === 'synthetic' || result.source === 'stale',
    },
  };
}

function cacheKeyFor(source: 'carbon' | 'weather' | 'price', region: RegionCode) {
  return { pk: `SRC#${source}#${region}`, sk: `BUCKET#${floorToBucket(15)}` };
}

function buildMeta(
  requestId: string,
  result: {
    source: 'fresh' | 'cache' | 'stale';
    stalenessSeconds?: number;
    value: { fetchedAt: string };
  },
) {
  const ageSeconds = Math.floor((Date.now() - new Date(result.value.fetchedAt).getTime()) / 1000);
  return {
    requestId,
    dataAgeSeconds: ageSeconds,
    degraded: result.source === 'stale',
    source: result.source,
  };
}
