import { z } from 'zod';

import type {
  CarbonForecast,
  CarbonIndexLevel,
  CarbonReading,
  UkRegionCode,
} from '../../domain/energy.js';
import { UpstreamUnavailableError } from '../../domain/errors.js';
import { logger } from '../logger.js';
import { sharedCircuitBreaker } from './_lib/circuit-breaker.js';
import { withRetry } from './_lib/retry.js';

const BASE_URL = 'https://api.carbonintensity.org.uk';
const UPSTREAM_NAME = 'carbon-intensity';

const REGION_TO_DNO_ID: Record<UkRegionCode, number> = {
  'GB-NATIONAL': 17,
  'GB-NORTH-SCOTLAND': 1,
  'GB-SOUTH-SCOTLAND': 2,
  'GB-NORTH-WEST-ENGLAND': 3,
  'GB-NORTH-EAST-ENGLAND': 4,
  'GB-YORKSHIRE': 5,
  'GB-NORTH-WALES': 6,
  'GB-SOUTH-WALES': 7,
  'GB-WEST-MIDLANDS': 8,
  'GB-EAST-MIDLANDS': 9,
  'GB-EAST-ENGLAND': 10,
  'GB-SOUTH-WEST-ENGLAND': 11,
  'GB-SOUTH-ENGLAND': 12,
  'GB-LON': 13,
  'GB-SOUTH-EAST-ENGLAND': 14,
};

const intensityLevelSchema = z.enum(['very low', 'low', 'moderate', 'high', 'very high']);

const regionalReadingSchema = z.object({
  from: z.string(),
  to: z.string(),
  intensity: z.object({
    forecast: z.number(),
    index: intensityLevelSchema,
  }),
});

const regionalForecastResponseSchema = z.object({
  data: z.object({
    regionid: z.number(),
    shortname: z.string().optional(),
    data: z.array(regionalReadingSchema),
  }),
});

const nationalForecastResponseSchema = z.object({
  data: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      intensity: z.object({
        forecast: z.number().nullable(),
        actual: z.number().nullable().optional(),
        index: intensityLevelSchema,
      }),
    }),
  ),
});

export interface CarbonIntensityClient {
  fetch24hForecast(region: UkRegionCode): Promise<CarbonForecast>;

  fetchHistorical(region: UkRegionCode, fromIso: string, toIso: string): Promise<CarbonForecast>;
}

export interface CarbonIntensityClientOptions {
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
  readonly retryAttempts?: number;
}

export function createCarbonIntensityClient(
  options: CarbonIntensityClientOptions = {},
): CarbonIntensityClient {
  const baseUrl = options.baseUrl ?? BASE_URL;
  const httpFetch = options.fetchImpl ?? fetch;
  const retryAttempts = options.retryAttempts ?? 2;

  return {
    fetch24hForecast: (region) =>
      sharedCircuitBreaker.execute(UPSTREAM_NAME, async () => {
        const url = buildForecastUrl(baseUrl, region);

        const rawResponse = await withRetry(async () => fetchJson(httpFetch, url, UPSTREAM_NAME), {
          attempts: retryAttempts,
          baseDelayMs: 250,
          maxDelayMs: 2_000,
          operationName: 'carbon-intensity.fetch24h',
        });

        return parseResponse(rawResponse, region);
      }),

    fetchHistorical: (region, fromIso, toIso) =>
      sharedCircuitBreaker.execute(UPSTREAM_NAME, async () => {
        const url = buildHistoricalUrl(baseUrl, region, fromIso, toIso);

        const rawResponse = await withRetry(async () => fetchJson(httpFetch, url, UPSTREAM_NAME), {
          attempts: retryAttempts,
          baseDelayMs: 250,
          maxDelayMs: 2_000,
          operationName: 'carbon-intensity.fetchHistorical',
        });

        return parseHistoricalResponse(rawResponse, region);
      }),
  };
}

function buildHistoricalUrl(
  baseUrl: string,
  region: UkRegionCode,
  fromIso: string,
  toIso: string,
): string {
  const from = fromIso.slice(0, 16) + 'Z';
  const to = toIso.slice(0, 16) + 'Z';
  if (region === 'GB-NATIONAL') {
    return `${baseUrl}/intensity/${from}/${to}`;
  }
  const dnoId = REGION_TO_DNO_ID[region];
  return `${baseUrl}/regional/intensity/${from}/${to}/regionid/${dnoId}`;
}

function parseHistoricalResponse(rawResponse: unknown, region: UkRegionCode): CarbonForecast {
  const fetchedAt = new Date().toISOString();
  // Reuse the forecast parsers (shape is identical) then re-tag every
  // reading as `actual` — these are past slots, not predictions.
  const base =
    region === 'GB-NATIONAL'
      ? parseNationalResponse(rawResponse, fetchedAt)
      : parseRegionalResponse(rawResponse, region, fetchedAt);
  return {
    ...base,
    readings: base.readings.map((reading) => ({ ...reading, kind: 'actual' as const })),
  };
}

function buildForecastUrl(baseUrl: string, region: UkRegionCode): string {
  if (region === 'GB-NATIONAL') {
    // National: 30-minute slots, today's data
    return `${baseUrl}/intensity/date`;
  }
  // Regional 48h forward forecast — endpoint requires an ISO8601 `from`
  // datetime. Spec: /regional/intensity/{from}/fw48h/regionid/{regionid}
  // 48h matches the weather forecast horizon and lets the chart visualise
  // "tomorrow's window" scenarios. Strips seconds because the API rejects
  // sub-minute precision.
  const dnoId = REGION_TO_DNO_ID[region];
  const fromIso = new Date().toISOString().slice(0, 16) + 'Z'; // YYYY-MM-DDTHH:MMZ
  return `${baseUrl}/regional/intensity/${fromIso}/fw48h/regionid/${dnoId}`;
}

async function fetchJson(httpFetch: typeof fetch, url: string, upstream: string): Promise<unknown> {
  const response = await httpFetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new UpstreamUnavailableError(`${upstream} responded with HTTP ${response.status}`, {
      upstream,
      status: response.status,
    });
  }
  return (await response.json()) as unknown;
}

function parseResponse(rawResponse: unknown, region: UkRegionCode): CarbonForecast {
  const fetchedAt = new Date().toISOString();

  if (region === 'GB-NATIONAL') {
    return parseNationalResponse(rawResponse, fetchedAt);
  }
  return parseRegionalResponse(rawResponse, region, fetchedAt);
}

function parseRegionalResponse(
  rawResponse: unknown,
  region: UkRegionCode,
  fetchedAt: string,
): CarbonForecast {
  const parsed = regionalForecastResponseSchema.safeParse(rawResponse);
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.issues }, 'carbon-intensity regional schema mismatch');
    throw new UpstreamUnavailableError('carbon-intensity returned unexpected shape', {
      upstream: UPSTREAM_NAME,
    });
  }
  const readings: CarbonReading[] = parsed.data.data.data.map((entry) =>
    flagIfImplausible({
      region,
      from: entry.from,
      to: entry.to,
      intensityGCo2PerKwh: entry.intensity.forecast,
      index: entry.intensity.index as CarbonIndexLevel,
      kind: 'forecast',
    }),
  );
  return { region, fetchedAt, readings };
}

function parseNationalResponse(rawResponse: unknown, fetchedAt: string): CarbonForecast {
  const parsed = nationalForecastResponseSchema.safeParse(rawResponse);
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.issues }, 'carbon-intensity national schema mismatch');
    throw new UpstreamUnavailableError('carbon-intensity returned unexpected shape', {
      upstream: UPSTREAM_NAME,
    });
  }
  const readings: CarbonReading[] = parsed.data.data
    .filter((entry) => entry.intensity.forecast !== null)
    .map((entry) =>
      flagIfImplausible({
        region: 'GB-NATIONAL' as const,
        from: entry.from,
        to: entry.to,
        intensityGCo2PerKwh: entry.intensity.forecast as number,
        index: entry.intensity.index as CarbonIndexLevel,
        kind: entry.intensity.actual != null ? 'actual' : 'forecast',
      }),
    );
  return { region: 'GB-NATIONAL', fetchedAt, readings };
}

/**
 * Lower physical bound for UK grid carbon intensity (g CO₂/kWh).
 *
 * Calibrated against historical National Grid ESO records: the cleanest
 * 30-min window the UK has ever recorded is ~40 g/kWh (extreme wind +
 * minimal demand). Anything below 30 implies the upstream model is
 * returning an impossible mix (we've observed Carbon Intensity API report
 * `solar: 91%` at 03:00 UTC — physically impossible before sunrise).
 *
 * We do NOT replace the value. We just mark the reading so downstream
 * callers (chart, AI context filter, stats panel) can decide.
 */
const UK_PHYSICAL_FLOOR_GCO2_PER_KWH = 30;

function flagIfImplausible(reading: CarbonReading): CarbonReading {
  if (reading.intensityGCo2PerKwh < UK_PHYSICAL_FLOOR_GCO2_PER_KWH) {
    logger.warn(
      {
        upstream: UPSTREAM_NAME,
        from: reading.from,
        intensityGCo2PerKwh: reading.intensityGCo2PerKwh,
        floor: UK_PHYSICAL_FLOOR_GCO2_PER_KWH,
      },
      'carbon-intensity returned a physically implausible value; flagging reading as unreliable',
    );
    return { ...reading, unreliable: true };
  }
  return reading;
}
