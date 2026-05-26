import { describe, expect, it, vi } from 'vitest';

import { sharedCircuitBreaker } from '../../src/infra/clients/_lib/circuit-breaker.js';
import { createOpenMeteoClient } from '../../src/infra/clients/open-meteo.client.js';

const sampleResponse = {
  hourly: {
    time: ['2026-05-24T14:00', '2026-05-24T15:00'],
    temperature_2m: [18.5, 19.1],
    cloud_cover: [42, 51],
    wind_speed_10m: [4.2, 5.0],
    precipitation: [0, 0.2],
  },
};

const okJsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('OpenMeteoClient.fetch48hForecast', () => {
  it('uses lat/lon for the requested UK region', async () => {
    sharedCircuitBreaker.reset();
    const fetchImpl = vi.fn().mockResolvedValue(okJsonResponse(sampleResponse));

    const client = createOpenMeteoClient({ fetchImpl, retryAttempts: 1 });
    await client.fetch48hForecast('GB-LON');

    const requestedUrl = fetchImpl.mock.calls[0]?.[0] as string;
    expect(requestedUrl).toContain('latitude=51.5074');
    expect(requestedUrl).toContain('longitude=-0.1278');
    expect(requestedUrl).toContain('forecast_days=2');
    expect(requestedUrl).toContain('timezone=UTC');
  });

  it('normalises hourly arrays into WeatherSnapshot[]', async () => {
    sharedCircuitBreaker.reset();
    const fetchImpl = vi.fn().mockResolvedValue(okJsonResponse(sampleResponse));

    const client = createOpenMeteoClient({ fetchImpl, retryAttempts: 1 });
    const forecast = await client.fetch48hForecast('GB-LON');

    expect(forecast.snapshots).toHaveLength(2);
    expect(forecast.snapshots[0]?.temperatureCelsius).toBe(18.5);
    expect(forecast.snapshots[0]?.cloudCoverPercent).toBe(42);
    expect(forecast.snapshots[0]?.windSpeedMps).toBe(4.2);
    expect(forecast.snapshots[0]?.at).toMatch(/Z$/);
  });
});
