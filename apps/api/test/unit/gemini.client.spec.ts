import { describe, expect, it, vi } from 'vitest';

import { createGeminiClient } from '../../src/infra/ai/gemini.client.js';

const successResponse = (text: string, usage = {}): Response =>
  new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, ...usage },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

const tooManyRequestsResponse = (perDay: boolean, retryDelay = '2s'): Response =>
  new Response(
    JSON.stringify({
      error: {
        code: 429,
        status: 'RESOURCE_EXHAUSTED',
        message: 'Quota exceeded',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
            violations: [{ quotaMetric: perDay ? 'PerDay' : 'PerMinute' }],
          },
          { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay },
        ],
      },
    }),
    { status: 429, headers: { 'content-type': 'application/json' } },
  );

const baseArgs = {
  modelId: 'gemini-3.1-flash-lite',
  systemInstruction: 'system',
  userPrompt: 'user',
  responseSchema: { type: 'object' as const },
  generationConfig: { temperature: 0, seed: 42, maxOutputTokens: 100 },
};

describe('createGeminiClient', () => {
  it('posts to the configured endpoint with the right body shape (key in header, NOT URL)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(successResponse('{"ok":true}'));
    const client = createGeminiClient({ apiKey: 'super-secret-key', fetchImpl });

    await client.generate(baseArgs);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/models/gemini-3.1-flash-lite:generateContent');

    expect(url).not.toContain('super-secret-key');
    expect(url).not.toContain('key=');
    expect(init.method).toBe('POST');

    const headers = init.headers as Record<string, string>;
    expect(headers['x-goog-api-key']).toBe('super-secret-key');
    expect(headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.systemInstruction).toBeDefined();
    expect(body.generationConfig).toMatchObject({
      temperature: 0,
      responseMimeType: 'application/json',
    });
    expect(body.safetySettings).toBeDefined();
  });

  it('extracts text + usage from a successful response', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(successResponse('{"ok":true}', { thoughtsTokenCount: 20 }));
    const client = createGeminiClient({ apiKey: 'k', fetchImpl });

    const result = await client.generate(baseArgs);
    expect(result.text).toBe('{"ok":true}');
    expect(result.modelUsed).toBe('gemini-3.1-flash-lite');
    expect(result.usage.promptTokens).toBe(100);
    expect(result.usage.outputTokens).toBe(50);
    expect(result.usage.thoughtsTokens).toBe(20);
  });

  it('retries on transient 5xx ("Internal error encountered") and recovers', async () => {
    const makeInternalError = (): Response =>
      new Response(
        JSON.stringify({
          error: { code: 500, status: 'INTERNAL', message: 'Internal error encountered.' },
        }),
        { status: 500, headers: { 'content-type': 'application/json' } },
      );
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(() => Promise.resolve(makeInternalError()))
      .mockImplementationOnce(() => Promise.resolve(makeInternalError()))
      .mockImplementationOnce(() => Promise.resolve(successResponse('{"ok":true}')));
    const client = createGeminiClient({ apiKey: 'k', fetchImpl });

    const result = await client.generate(baseArgs);

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(result.text).toBe('{"ok":true}');
  });

  it('gives up after 3 5xx attempts when error persists', async () => {
    const makeInternalError = (): Response =>
      new Response(JSON.stringify({ error: { code: 503, message: 'Service unavailable' } }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      });
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(makeInternalError()));
    const client = createGeminiClient({ apiKey: 'k', fetchImpl });

    await expect(client.generate(baseArgs)).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('throws on 429 when no fallback is configured (single-model deployment)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(tooManyRequestsResponse(true))
      .mockResolvedValueOnce(tooManyRequestsResponse(true));
    const client = createGeminiClient({ apiKey: 'k', fetchImpl });

    await expect(client.generate(baseArgs)).rejects.toThrow(/quota/i);
  });

  it('cascades to fallback model when one is supplied (mechanism still works for future use)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(tooManyRequestsResponse(true))
      .mockResolvedValueOnce(successResponse('{"ok":true}'));

    const client = createGeminiClient({ apiKey: 'k', fetchImpl });
    const result = await client.generate({
      ...baseArgs,
      fallbackModelId: 'gemini-3.5-flash',
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const secondUrl = fetchImpl.mock.calls[1]?.[0] as string;
    expect(secondUrl).toContain('gemini-3.5-flash');
    expect(result.fellBackFrom).toBe('gemini-3.1-flash-lite');
    expect(result.modelUsed).toBe('gemini-3.5-flash');
  });

  it('throws if SAFETY filter blocks the response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '' }] }, finishReason: 'SAFETY' }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 0 },
        }),
        { status: 200 },
      ),
    );
    const client = createGeminiClient({ apiKey: 'k', fetchImpl });
    await expect(client.generate(baseArgs)).rejects.toThrow(/safety filter/i);
  });
});
