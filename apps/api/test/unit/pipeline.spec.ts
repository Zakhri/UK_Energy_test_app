import { describe, expect, it, vi } from 'vitest';

import { AiPipeline, type ContextSummary } from '../../src/infra/ai/pipeline.js';
import type { OptimalWindow } from '../../src/domain/optimal-window.js';
import { InMemoryCacheRepository } from '../../src/infra/cache/in-memory-cache.repository.js';
import { RateLimiter } from '../../src/infra/ai/rate-limiter.js';
import { TelemetryRecorder } from '../../src/infra/ai/telemetry.js';
import type { GeminiClient } from '../../src/infra/ai/gemini.client.js';

const sampleSummary: ContextSummary = {
  priceSource: 'entsoe',
  oldestDataAgeMinutes: 5,
  unreliableCarbonCount: 0,
  contextSourcesPresent: 3,
};

const sampleWindows: readonly OptimalWindow[] = [
  {
    id: 'w1',
    windowStart: '2026-05-24T02:00Z',
    windowEnd: '2026-05-24T06:00Z',
    avgCarbonGCo2: 142,
    avgCostPounds: 0.095,
    score: 0.92,
    priority: 1,
  },
];

const goodExplainerOutput = JSON.stringify({
  refused: false,
  summary: 'Charge in the overnight low-demand window for the lowest carbon impact.',
  windowNarratives: [
    {
      id: 'w1',
      reasoning: 'Wind generation lifts overnight per the regional forecast.',
      tradeoffs: 'Charger runs unattended overnight.',
    },
  ],
  caveats: [],
  citations: ['carbon-intensity', 'open-meteo'],
});

function buildPipeline(geminiStub: GeminiClient) {
  const cache = new InMemoryCacheRepository();
  return {
    pipeline: new AiPipeline({
      cache,
      gemini: geminiStub,
      rateLimiter: new RateLimiter(cache, {
        modelId: 'gemini-3.1-flash-lite',
        rpmLimit: 10,
        rpdLimit: 100,
        dailyBudgetUsd: 1,
      }),
      telemetry: new TelemetryRecorder(cache),
      modelId: 'gemini-3.1-flash-lite',
    }),
    cache,
  };
}

describe('AiPipeline.generateRecommendations', () => {
  it('returns parsed narrative + confidence + meta on the happy path', async () => {
    const generate = vi.fn().mockResolvedValue({
      text: goodExplainerOutput,
      finishReason: 'STOP',
      modelUsed: 'gemini-3.1-flash-lite',
      usage: { promptTokens: 600, outputTokens: 200, thoughtsTokens: 0, cachedInputTokens: 0 },
    });
    const { pipeline } = buildPipeline({ generate });

    const result = await pipeline.generateRecommendations(
      {
        goal: 'ev-charge',
        region: 'GB-LON',
        kwhRequired: 40,
        deadline: '2026-05-25T07:00Z',
        preferences: ['low-carbon', 'avoid-peak'],
      },
      sampleWindows,
      sampleSummary,
      'req-1',
    );

    expect(result.payload.refused).toBe(false);
    expect(result.payload.windowNarratives).toHaveLength(1);
    expect(result.payload.windowNarratives[0]?.id).toBe('w1');
    expect(result.confidence.overall).toBeGreaterThan(0.6);
    expect(result.meta.modelUsed).toBe('gemini-3.1-flash-lite');
    expect(result.meta.cacheHit).toBe(false);
    expect(result.meta.costUsd).toBeGreaterThan(0);
  });

  it('cache key changes when region / preferences / windows differ (stableJson regression)', async () => {
    const generate = vi.fn().mockResolvedValue({
      text: goodExplainerOutput,
      finishReason: 'STOP',
      modelUsed: 'gemini-3.1-flash-lite',
      usage: { promptTokens: 600, outputTokens: 200, thoughtsTokens: 0, cachedInputTokens: 0 },
    });
    const { pipeline } = buildPipeline({ generate });

    const baseRequest = {
      goal: 'ev-charge' as const,
      region: 'GB-LON' as const,
      kwhRequired: 40,
      preferences: ['low-carbon'] as const,
    };
    const otherWindows: readonly OptimalWindow[] = [
      { ...sampleWindows[0]!, windowStart: '2026-05-24T10:00Z', windowEnd: '2026-05-24T14:00Z' },
    ];

    await pipeline.generateRecommendations(baseRequest, sampleWindows, sampleSummary, 'r1');
    await pipeline.generateRecommendations(baseRequest, sampleWindows, sampleSummary, 'r2');

    await pipeline.generateRecommendations(
      { ...baseRequest, region: 'GB-NORTH-SCOTLAND' },
      sampleWindows,
      sampleSummary,
      'r3',
    );

    await pipeline.generateRecommendations(baseRequest, otherWindows, sampleSummary, 'r4');

    await pipeline.generateRecommendations(
      { ...baseRequest, preferences: ['low-price'] },
      sampleWindows,
      sampleSummary,
      'r5',
    );

    expect(generate).toHaveBeenCalledTimes(4);
  });

  it('serves the cached result on the second call (no extra Gemini hit)', async () => {
    const generate = vi.fn().mockResolvedValue({
      text: goodExplainerOutput,
      finishReason: 'STOP',
      modelUsed: 'gemini-3.1-flash-lite',
      usage: { promptTokens: 600, outputTokens: 200, thoughtsTokens: 0, cachedInputTokens: 0 },
    });
    const { pipeline } = buildPipeline({ generate });

    const request = {
      goal: 'ev-charge' as const,
      region: 'GB-LON' as const,
      kwhRequired: 40,
      deadline: '2026-05-25T07:00Z',
      preferences: ['low-carbon'] as const,
    };
    await pipeline.generateRecommendations(request, sampleWindows, sampleSummary, 'req-1');
    const second = await pipeline.generateRecommendations(
      request,
      sampleWindows,
      sampleSummary,
      'req-2',
    );

    expect(generate).toHaveBeenCalledTimes(1);
    expect(second.meta.cacheHit).toBe(true);
    expect(second.meta.requestId).toBe('req-2');
  });

  it('throws AiRefusedError when the model returns invalid JSON', async () => {
    const generate = vi.fn().mockResolvedValue({
      text: 'not actually json',
      finishReason: 'STOP',
      modelUsed: 'gemini-3.1-flash-lite',
      usage: { promptTokens: 10, outputTokens: 5, thoughtsTokens: 0, cachedInputTokens: 0 },
    });
    const { pipeline } = buildPipeline({ generate });

    await expect(
      pipeline.generateRecommendations(
        {
          goal: 'ev-charge',
          region: 'GB-LON',
          kwhRequired: 40,
          preferences: ['low-carbon'],
        },
        sampleWindows,
        sampleSummary,
        'req-x',
      ),
    ).rejects.toThrow(/validation/i);
  });

  it('does not cache refused responses', async () => {
    const refusedOutput = JSON.stringify({
      refused: true,
      refusalReason: 'Off-topic',
      summary: '',
      windowNarratives: [],
      caveats: [],
      citations: [],
    });
    const generate = vi
      .fn()
      .mockResolvedValueOnce({
        text: refusedOutput,
        finishReason: 'STOP',
        modelUsed: 'gemini-3.1-flash-lite',
        usage: { promptTokens: 30, outputTokens: 20, thoughtsTokens: 0, cachedInputTokens: 0 },
      })
      .mockResolvedValueOnce({
        text: refusedOutput,
        finishReason: 'STOP',
        modelUsed: 'gemini-3.1-flash-lite',
        usage: { promptTokens: 30, outputTokens: 20, thoughtsTokens: 0, cachedInputTokens: 0 },
      });
    const { pipeline } = buildPipeline({ generate });

    const request = {
      goal: 'general' as const,
      region: 'GB-LON' as const,
      kwhRequired: 0,
      preferences: [] as const,
    };
    await pipeline.generateRecommendations(request, sampleWindows, sampleSummary, 'r1');
    await pipeline.generateRecommendations(request, sampleWindows, sampleSummary, 'r2');

    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('propagates fallbackUsed when Gemini cascaded', async () => {
    const generate = vi.fn().mockResolvedValue({
      text: goodExplainerOutput,
      finishReason: 'STOP',
      modelUsed: 'gemini-3.5-flash',
      fellBackFrom: 'gemini-3.1-flash-lite',
      usage: { promptTokens: 600, outputTokens: 200, thoughtsTokens: 0, cachedInputTokens: 0 },
    });
    const { pipeline } = buildPipeline({ generate });

    const result = await pipeline.generateRecommendations(
      {
        goal: 'ev-charge',
        region: 'GB-LON',
        kwhRequired: 40,
        preferences: ['low-carbon'],
      },
      sampleWindows,
      sampleSummary,
      'req-fallback',
    );

    expect(result.meta.degraded).toBe(true);
    expect(result.meta.fallbackUsed).toBe('gemini-3.1-flash-lite');
  });
});
