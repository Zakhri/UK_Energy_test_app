import { describe, expect, it } from 'vitest';

import { estimateCostUsd } from '../../src/infra/ai/pricing.js';

describe('estimateCostUsd', () => {
  it('prices 3.1 Flash-Lite correctly for a typical call', () => {
    const cost = estimateCostUsd('gemini-3.1-flash-lite', {
      promptTokens: 1000,
      outputTokens: 500,
      thoughtsTokens: 0,
      cachedInputTokens: 0,
    });

    expect(cost).toBeCloseTo(0.001, 5);
  });

  it('applies the 90% cache discount on cachedInputTokens', () => {
    const cost = estimateCostUsd('gemini-3.1-flash-lite', {
      promptTokens: 1000,
      outputTokens: 0,
      thoughtsTokens: 0,
      cachedInputTokens: 1000,
    });

    expect(cost).toBeCloseTo(0.000025, 6);
  });

  it('treats thoughts tokens as output-priced', () => {
    const withThoughts = estimateCostUsd('gemini-3.1-flash-lite', {
      promptTokens: 0,
      outputTokens: 0,
      thoughtsTokens: 500,
      cachedInputTokens: 0,
    });
    expect(withThoughts).toBeCloseTo(0.00075, 5);
  });

  it('returns 0 for an unknown model (we no longer guess pricing)', () => {
    const cost = estimateCostUsd('gemini-future-mystery', {
      promptTokens: 1000,
      outputTokens: 0,
      thoughtsTokens: 0,
      cachedInputTokens: 0,
    });
    expect(cost).toBe(0);
  });
});
