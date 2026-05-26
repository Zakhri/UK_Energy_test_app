import { round } from '../../_lib/math.js';

export interface ModelPrice {
  readonly inputUsdPerMillion: number;
  readonly outputUsdPerMillion: number;
}

export const MODEL_PRICING: Record<string, ModelPrice> = {
  'gemini-3.1-flash-lite': { inputUsdPerMillion: 0.25, outputUsdPerMillion: 1.5 },
};

export const PRICING_SNAPSHOT_DATE = '2026-05-25';

export interface TokenUsage {
  readonly promptTokens: number;
  readonly outputTokens: number;

  readonly thoughtsTokens: number;

  readonly cachedInputTokens: number;
}

export function estimateCostUsd(modelId: string, usage: TokenUsage): number {
  const price = MODEL_PRICING[modelId];
  if (!price) return 0;
  return estimateForPrice(price, usage);
}

function estimateForPrice(price: ModelPrice, usage: TokenUsage): number {
  const billableInput = Math.max(0, usage.promptTokens - usage.cachedInputTokens);
  const inputCost = (billableInput * price.inputUsdPerMillion) / 1_000_000;
  const cachedCost = (usage.cachedInputTokens * price.inputUsdPerMillion * 0.1) / 1_000_000;
  const outputCost =
    ((usage.outputTokens + usage.thoughtsTokens) * price.outputUsdPerMillion) / 1_000_000;
  return round(inputCost + cachedCost + outputCost, 6);
}
