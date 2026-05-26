import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sharedCircuitBreaker } from '../../src/infra/clients/_lib/circuit-breaker.js';
import { createEntsoeClient } from '../../src/infra/clients/entsoe.client.js';

const liveXmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Publication_MarketDocument>
  <TimeSeries>
    <Period>
      <timeInterval>
        <start>2026-05-24T00:00Z</start>
        <end>2026-05-25T00:00Z</end>
      </timeInterval>
      <resolution>PT60M</resolution>
      <Point>
        <position>1</position>
        <price.amount>42.5</price.amount>
      </Point>
      <Point>
        <position>2</position>
        <price.amount>40.0</price.amount>
      </Point>
      <Point>
        <position>18</position>
        <price.amount>175.3</price.amount>
      </Point>
    </Period>
  </TimeSeries>
</Publication_MarketDocument>`;

const okXml = (body: string): Response =>
  new Response(body, { status: 200, headers: { 'content-type': 'application/xml' } });

describe('EntsoeClient — synthetic mode (no API key)', () => {
  beforeEach(() => sharedCircuitBreaker.reset());

  it('returns a 48-point half-hourly curve marked as synthetic', async () => {
    const client = createEntsoeClient();
    const curve = await client.fetchDayAheadPrices('GB-LON');

    expect(curve.source).toBe('synthetic');
    expect(curve.currency).toBe('GBP');
    expect(curve.region).toBe('GB-LON');
    expect(curve.prices).toHaveLength(48);
  });

  it('produces an increasing-then-decreasing price profile across the day', async () => {
    const client = createEntsoeClient();
    const curve = await client.fetchDayAheadPrices('GB-LON');

    const nightPrice = curve.prices[6]?.pricePoundsPerMwh ?? 0;
    const eveningPeakPrice = curve.prices[36]?.pricePoundsPerMwh ?? 0;
    expect(eveningPeakPrice).toBeGreaterThan(nightPrice);
  });
});

describe('EntsoeClient — live mode (real ENTSO-E XML)', () => {
  beforeEach(() => sharedCircuitBreaker.reset());

  it('parses the day-ahead XML response and returns source=entsoe', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okXml(liveXmlResponse));
    const client = createEntsoeClient({ apiKey: 'real-key', fetchImpl });

    const curve = await client.fetchDayAheadPrices('GB-LON');

    expect(curve.source).toBe('entsoe');
    expect(curve.currency).toBe('GBP');
    expect(curve.prices).toHaveLength(3);
    expect(curve.prices[0]?.pricePoundsPerMwh).toBe(42.5);
    expect(curve.prices[0]?.from).toBe('2026-05-24T00:00:00.000Z');
    expect(curve.prices[0]?.to).toBe('2026-05-24T01:00:00.000Z');

    expect(curve.prices.find((p) => p.from.startsWith('2026-05-24T17'))).toBeDefined();
  });

  it('builds a request with the correct ENTSO-E query parameters', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okXml(liveXmlResponse));
    const client = createEntsoeClient({ apiKey: 'real-key', fetchImpl });

    await client.fetchDayAheadPrices('GB-LON');

    const url = fetchImpl.mock.calls[0]?.[0] as string;
    expect(url).toContain('https://web-api.tp.entsoe.eu/api');
    expect(url).toContain('securityToken=real-key');
    expect(url).toContain('documentType=A44');
    expect(url).toContain('in_Domain=10Y1001A1001A92E');
    expect(url).toContain('out_Domain=10Y1001A1001A92E');
    expect(url).toMatch(/periodStart=\d{12}/);
    expect(url).toMatch(/periodEnd=\d{12}/);
  });

  it('falls back to synthetic on HTTP 5xx', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('upstream down', { status: 503 }));
    const client = createEntsoeClient({ apiKey: 'real-key', fetchImpl });

    const curve = await client.fetchDayAheadPrices('GB-LON');
    expect(curve.source).toBe('synthetic');
    expect(curve.prices).toHaveLength(48);
  });

  it('falls back to synthetic on malformed XML', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okXml('<not><valid<xml>'));
    const client = createEntsoeClient({ apiKey: 'real-key', fetchImpl });

    const curve = await client.fetchDayAheadPrices('GB-LON');
    expect(curve.source).toBe('synthetic');
  });

  it('falls back to synthetic when the XML schema does not match', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(okXml('<?xml version="1.0"?><wrong><shape>hello</shape></wrong>'));
    const client = createEntsoeClient({ apiKey: 'real-key', fetchImpl });

    const curve = await client.fetchDayAheadPrices('GB-LON');
    expect(curve.source).toBe('synthetic');
  });
});
