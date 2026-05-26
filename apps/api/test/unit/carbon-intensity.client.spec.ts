import { describe, expect, it, vi } from 'vitest';

import { UpstreamUnavailableError } from '../../src/domain/errors.js';
import { sharedCircuitBreaker } from '../../src/infra/clients/_lib/circuit-breaker.js';
import { createCarbonIntensityClient } from '../../src/infra/clients/carbon-intensity.client.js';

const successfulRegionalResponse = {
  data: {
    regionid: 13,
    shortname: 'London',
    data: [
      {
        from: '2026-05-24T14:00Z',
        to: '2026-05-24T14:30Z',
        intensity: { forecast: 142, index: 'moderate' },
      },
      {
        from: '2026-05-24T14:30Z',
        to: '2026-05-24T15:00Z',
        intensity: { forecast: 128, index: 'low' },
      },
    ],
  },
};

const okJsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('CarbonIntensityClient.fetch24hForecast', () => {
  it('targets the regional fw48h endpoint with ISO from and correct DNO id', async () => {
    sharedCircuitBreaker.reset();
    const fetchImpl = vi.fn().mockResolvedValue(okJsonResponse(successfulRegionalResponse));

    const client = createCarbonIntensityClient({ fetchImpl, retryAttempts: 1 });
    await client.fetch24hForecast('GB-LON');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const url = fetchImpl.mock.calls[0]?.[0] as string;

    expect(url).toMatch(
      /\/regional\/intensity\/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z\/fw48h\/regionid\/13$/,
    );
  });

  it('normalises the response into the CarbonForecast domain shape', async () => {
    sharedCircuitBreaker.reset();
    const fetchImpl = vi.fn().mockResolvedValue(okJsonResponse(successfulRegionalResponse));

    const client = createCarbonIntensityClient({ fetchImpl, retryAttempts: 1 });
    const forecast = await client.fetch24hForecast('GB-LON');

    expect(forecast.region).toBe('GB-LON');
    expect(forecast.readings).toHaveLength(2);
    expect(forecast.readings[0]?.intensityGCo2PerKwh).toBe(142);
    expect(forecast.readings[0]?.index).toBe('moderate');
    expect(forecast.readings[0]?.kind).toBe('forecast');
  });

  it('throws UpstreamUnavailableError on HTTP 5xx', async () => {
    sharedCircuitBreaker.reset();
    const fetchImpl = vi.fn().mockResolvedValue(new Response('upstream down', { status: 503 }));

    const client = createCarbonIntensityClient({ fetchImpl, retryAttempts: 1 });
    await expect(client.fetch24hForecast('GB-LON')).rejects.toBeInstanceOf(
      UpstreamUnavailableError,
    );
  });

  it('throws UpstreamUnavailableError on schema mismatch', async () => {
    sharedCircuitBreaker.reset();
    const fetchImpl = vi.fn().mockResolvedValue(okJsonResponse({ totally: 'wrong shape' }));

    const client = createCarbonIntensityClient({ fetchImpl, retryAttempts: 1 });
    await expect(client.fetch24hForecast('GB-LON')).rejects.toBeInstanceOf(
      UpstreamUnavailableError,
    );
  });

  it('flags sub-30 g/kWh readings as unreliable (physical UK grid floor)', async () => {
    sharedCircuitBreaker.reset();
    const responseWithAnomaly = {
      data: {
        regionid: 13,
        shortname: 'London',
        data: [
          {
            from: '2026-05-25T02:30Z',
            to: '2026-05-25T03:00Z',
            intensity: { forecast: 184, index: 'high' },
          },
          {
            from: '2026-05-25T03:00Z',
            to: '2026-05-25T03:30Z',
            intensity: { forecast: 5, index: 'very low' },
          },
          {
            from: '2026-05-25T03:30Z',
            to: '2026-05-25T04:00Z',
            intensity: { forecast: 29, index: 'very low' },
          },
        ],
      },
    };
    const fetchImpl = vi.fn().mockResolvedValue(okJsonResponse(responseWithAnomaly));
    const client = createCarbonIntensityClient({ fetchImpl, retryAttempts: 1 });
    const forecast = await client.fetch24hForecast('GB-LON');

    expect(forecast.readings).toHaveLength(3);
    expect(forecast.readings[0]?.unreliable).toBeUndefined();
    expect(forecast.readings[1]?.unreliable).toBe(true);
    expect(forecast.readings[2]?.unreliable).toBe(true);

    expect(forecast.readings[1]?.intensityGCo2PerKwh).toBe(5);
    expect(forecast.readings[2]?.intensityGCo2PerKwh).toBe(29);
  });
});
