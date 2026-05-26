import { z } from 'zod';

import type { UkRegionCode, WeatherForecast, WeatherSnapshot } from '../../domain/energy.js';
import { UK_REGION_COORDINATES } from '../../domain/energy.js';
import { UpstreamUnavailableError } from '../../domain/errors.js';
import { logger } from '../logger.js';
import { sharedCircuitBreaker } from './_lib/circuit-breaker.js';
import { withRetry } from './_lib/retry.js';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const UPSTREAM_NAME = 'open-meteo';

const HOURLY_VARIABLES = ['temperature_2m', 'cloud_cover', 'wind_speed_10m', 'precipitation'];

const openMeteoResponseSchema = z.object({
  hourly: z.object({
    time: z.array(z.string()),
    temperature_2m: z.array(z.number()),
    cloud_cover: z.array(z.number()),
    wind_speed_10m: z.array(z.number()),
    precipitation: z.array(z.number()),
  }),
  hourly_units: z
    .object({
      temperature_2m: z.string().optional(),
      cloud_cover: z.string().optional(),
      wind_speed_10m: z.string().optional(),
    })
    .optional(),
});

export interface OpenMeteoClient {
  fetch48hForecast(region: UkRegionCode): Promise<WeatherForecast>;
}

export interface OpenMeteoClientOptions {
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
  readonly retryAttempts?: number;
}

export function createOpenMeteoClient(options: OpenMeteoClientOptions = {}): OpenMeteoClient {
  const baseUrl = options.baseUrl ?? BASE_URL;
  const httpFetch = options.fetchImpl ?? fetch;
  const retryAttempts = options.retryAttempts ?? 2;

  return {
    fetch48hForecast: (region) =>
      sharedCircuitBreaker.execute(UPSTREAM_NAME, async () => {
        const url = buildForecastUrl(baseUrl, region);
        const rawResponse = await withRetry(async () => fetchJson(httpFetch, url), {
          attempts: retryAttempts,
          baseDelayMs: 250,
          maxDelayMs: 2_000,
          operationName: 'open-meteo.fetch48h',
        });
        return parseResponse(rawResponse, region);
      }),
  };
}

function buildForecastUrl(baseUrl: string, region: UkRegionCode): string {
  const { lat, lon } = UK_REGION_COORDINATES[region];
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    hourly: HOURLY_VARIABLES.join(','),
    forecast_days: '2',
    timezone: 'UTC',
    windspeed_unit: 'ms',
  });
  return `${baseUrl}?${params.toString()}`;
}

async function fetchJson(httpFetch: typeof fetch, url: string): Promise<unknown> {
  const response = await httpFetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new UpstreamUnavailableError(`${UPSTREAM_NAME} responded with HTTP ${response.status}`, {
      upstream: UPSTREAM_NAME,
      status: response.status,
    });
  }
  return (await response.json()) as unknown;
}

function parseResponse(rawResponse: unknown, region: UkRegionCode): WeatherForecast {
  const parsed = openMeteoResponseSchema.safeParse(rawResponse);
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.issues }, 'open-meteo schema mismatch');
    throw new UpstreamUnavailableError('open-meteo returned unexpected shape', {
      upstream: UPSTREAM_NAME,
    });
  }

  const { hourly } = parsed.data;
  const snapshots: WeatherSnapshot[] = hourly.time.map((time, index) => ({
    at: ensureUtc(time),
    temperatureCelsius: hourly.temperature_2m[index] ?? 0,
    cloudCoverPercent: hourly.cloud_cover[index] ?? 0,
    windSpeedMps: hourly.wind_speed_10m[index] ?? 0,
    precipitationMm: hourly.precipitation[index] ?? 0,
  }));

  return {
    region,
    fetchedAt: new Date().toISOString(),
    snapshots,
  };
}

function ensureUtc(timestamp: string): string {
  // Open-Meteo returns ISO without 'Z' when timezone=UTC; normalise.
  return timestamp.endsWith('Z') ? timestamp : `${timestamp}Z`;
}
