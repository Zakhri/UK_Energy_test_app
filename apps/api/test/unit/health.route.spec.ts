import { describe, expect, it } from 'vitest';

import { app } from '../../src/api.js';

describe('GET /api/health', () => {
  it('returns 200 with status ok and dependency snapshot', async () => {
    const response = await app.request('/api/health');

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      status: string;
      environment: string;
      timestamp: string;
      dependencies: Record<string, string>;
    };

    expect(body.status).toBe('ok');
    expect(typeof body.environment).toBe('string');
    expect(body.dependencies).toHaveProperty('gemini');
    expect(body.dependencies).toHaveProperty('dynamodb');
    expect(body.dependencies).toHaveProperty('carbonIntensity');
    expect(body.dependencies).toHaveProperty('weather');
    expect(body.dependencies).toHaveProperty('entsoe');
  });

  it('sets X-Request-Id header on the response', async () => {
    const response = await app.request('/api/health');
    expect(response.headers.get('X-Request-Id')).toBeTruthy();
  });

  it('propagates a caller-provided x-request-id', async () => {
    const response = await app.request('/api/health', {
      headers: { 'x-request-id': 'caller-supplied-id-123' },
    });
    expect(response.headers.get('X-Request-Id')).toBe('caller-supplied-id-123');
  });
});

describe('Unknown route', () => {
  it('returns 404 problem+json', async () => {
    const response = await app.request('/api/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    const body = (await response.json()) as { status: number; title: string };
    expect(body.status).toBe(404);
    expect(body.title).toBe('Not Found');
  });
});
