import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';

import type { DayAheadPriceCurve, DayAheadPricePoint, UkRegionCode } from '../../domain/energy.js';
import { logger } from '../logger.js';
import { sharedCircuitBreaker } from './_lib/circuit-breaker.js';
import { withRetry } from './_lib/retry.js';

const ENTSOE_BASE_URL = 'https://web-api.tp.entsoe.eu/api';
const UPSTREAM_NAME = 'entsoe';
const GB_BZN_AREA_CODE = '10Y1001A1001A92E';
const DAY_AHEAD_DOCUMENT_TYPE = 'A44';

const syntheticSchema = z.object({
  description: z.string(),
  license: z.string(),
  currency: z.literal('GBP'),
  unit: z.string(),
  halfHourlyProfile: z.array(z.number()).length(48),
});

let syntheticProfile: number[] | null = null;

async function loadSyntheticProfile(): Promise<number[]> {
  if (syntheticProfile) return syntheticProfile;
  const here = dirname(fileURLToPath(import.meta.url));
  const dataPath = resolve(here, '../../../../../data/synthetic-prices.json');
  const raw = await readFile(dataPath, 'utf8');
  const parsed = syntheticSchema.parse(JSON.parse(raw));
  syntheticProfile = parsed.halfHourlyProfile;
  return syntheticProfile;
}

const pointSchema = z.object({
  position: z.coerce.number().int().min(1).max(96),
  'price.amount': z.coerce.number(),
});

const periodSchema = z.object({
  timeInterval: z.object({
    start: z.string(),
    end: z.string(),
  }),
  resolution: z.string(),
  Point: z
    .union([pointSchema, z.array(pointSchema)])
    .transform((value) => (Array.isArray(value) ? value : [value])),
});

const timeSeriesSchema = z.object({
  Period: z
    .union([periodSchema, z.array(periodSchema)])
    .transform((value) => (Array.isArray(value) ? value : [value])),
});

const responseSchema = z.object({
  Publication_MarketDocument: z.object({
    TimeSeries: z
      .union([timeSeriesSchema, z.array(timeSeriesSchema)])
      .transform((value) => (Array.isArray(value) ? value : [value])),
  }),
});

const xmlParser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
});

function resolutionMs(resolution: string): number {
  const match = resolution.match(/^PT(\d+)M$/);
  if (!match || match[1] === undefined) {
    throw new Error(`Unsupported ENTSO-E resolution: ${resolution}`);
  }
  return Number.parseInt(match[1], 10) * 60_000;
}

function parseEntsoeXml(xml: string, region: UkRegionCode): DayAheadPriceCurve {
  const raw = xmlParser.parse(xml) as unknown;
  const parsed = responseSchema.parse(raw);

  const prices: DayAheadPricePoint[] = [];
  for (const series of parsed.Publication_MarketDocument.TimeSeries) {
    for (const period of series.Period) {
      const slotMs = resolutionMs(period.resolution);
      const start = new Date(period.timeInterval.start).getTime();
      for (const point of period.Point) {
        const from = new Date(start + (point.position - 1) * slotMs);
        const to = new Date(from.getTime() + slotMs);
        prices.push({
          from: from.toISOString(),
          to: to.toISOString(),
          pricePoundsPerMwh: point['price.amount'],
        });
      }
    }
  }

  // Sort by start time and keep at most 48 forward points for the AI context.
  prices.sort((a, b) => a.from.localeCompare(b.from));
  return {
    region,
    fetchedAt: new Date().toISOString(),
    source: 'entsoe',
    currency: 'GBP',
    prices: prices.slice(0, 96),
  };
}

// ---------------------------------------------------------------------------
// Live HTTP call (with retry + circuit breaker)
// ---------------------------------------------------------------------------

function entsoeDateString(date: Date): string {
  const yyyy = date.getUTCFullYear().toString();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}${hh}${mi}`;
}

function buildLiveUrl(apiKey: string, areaCode: string): string {
  const now = new Date();
  const periodStart = entsoeDateString(now);
  const periodEnd = entsoeDateString(new Date(now.getTime() + 48 * 60 * 60 * 1000));
  const params = new URLSearchParams({
    securityToken: apiKey,
    documentType: DAY_AHEAD_DOCUMENT_TYPE,
    in_Domain: areaCode,
    out_Domain: areaCode,
    periodStart,
    periodEnd,
  });
  return `${ENTSOE_BASE_URL}?${params.toString()}`;
}

async function fetchLive(
  httpFetch: typeof fetch,
  apiKey: string,
  areaCode: string,
  region: UkRegionCode,
): Promise<DayAheadPriceCurve> {
  return sharedCircuitBreaker.execute(UPSTREAM_NAME, async () =>
    withRetry(
      async () => {
        const response = await httpFetch(buildLiveUrl(apiKey, areaCode), {
          headers: { Accept: 'application/xml' },
        });
        if (!response.ok) {
          throw new Error(`ENTSO-E HTTP ${response.status}`);
        }
        const xml = await response.text();
        return parseEntsoeXml(xml, region);
      },
      {
        attempts: 2,
        baseDelayMs: 400,
        maxDelayMs: 2_000,
        operationName: 'entsoe.dayAhead',
      },
    ),
  );
}

// ---------------------------------------------------------------------------
// Synthetic fallback (always serves a 48-point half-hourly curve)
// ---------------------------------------------------------------------------

async function buildSyntheticCurve(region: UkRegionCode): Promise<DayAheadPriceCurve> {
  const profile = await loadSyntheticProfile();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const halfHourMs = 30 * 60 * 1000;

  const prices: DayAheadPricePoint[] = profile.map((priceMwh, index) => {
    const from = new Date(startOfDay.getTime() + index * halfHourMs);
    const to = new Date(from.getTime() + halfHourMs);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      pricePoundsPerMwh: priceMwh,
    };
  });

  return {
    region,
    fetchedAt: new Date().toISOString(),
    source: 'synthetic',
    currency: 'GBP',
    prices,
  };
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export interface EntsoeClient {
  fetchDayAheadPrices(region: UkRegionCode): Promise<DayAheadPriceCurve>;
}

export interface EntsoeClientOptions {
  readonly apiKey?: string;
  readonly areaCode?: string;
  readonly fetchImpl?: typeof fetch;
}

export function createEntsoeClient(options: EntsoeClientOptions = {}): EntsoeClient {
  const httpFetch = options.fetchImpl ?? fetch;
  const areaCode = options.areaCode ?? GB_BZN_AREA_CODE;

  return {
    fetchDayAheadPrices: async (region) => {
      if (!options.apiKey) {
        return buildSyntheticCurve(region);
      }
      try {
        return await fetchLive(httpFetch, options.apiKey, areaCode, region);
      } catch (error) {
        logger.warn(
          {
            region,
            err: error instanceof Error ? error.message : String(error),
          },
          'ENTSO-E live fetch failed; serving synthetic fallback',
        );
        return buildSyntheticCurve(region);
      }
    },
  };
}
