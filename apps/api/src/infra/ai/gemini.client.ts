import { logger } from '../logger.js';
import { withRetry } from '../clients/_lib/retry.js';
import { assertCandidateUsable } from './guard.js';
import type { TokenUsage } from './pricing.js';

const ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const DEFAULT_SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
] as const;

export interface GeminiGenerationConfig {
  readonly temperature?: number;
  readonly topP?: number;
  readonly topK?: number;
  readonly seed?: number;
  readonly maxOutputTokens?: number;
  readonly thinkingBudget?: number;
}

export interface GeminiGenerateArgs {
  readonly modelId: string;
  readonly fallbackModelId?: string;
  readonly systemInstruction: string;
  readonly userPrompt: string;
  readonly responseSchema: Readonly<Record<string, unknown>>;
  readonly generationConfig?: GeminiGenerationConfig;
}

export interface GeminiGenerateResult {
  readonly text: string;
  readonly finishReason: string;
  readonly modelUsed: string;
  readonly fellBackFrom?: string;
  readonly usage: TokenUsage;
}

export interface GeminiClient {
  generate(args: GeminiGenerateArgs): Promise<GeminiGenerateResult>;
}

export interface GeminiClientOptions {
  readonly apiKey: string;
  readonly fetchImpl?: typeof fetch;
  readonly baseUrl?: string;
}

interface GeminiResponseShape {
  readonly candidates?: ReadonlyArray<{
    readonly content?: { readonly parts?: ReadonlyArray<{ readonly text?: string }> };
    readonly finishReason?: string;
  }>;
  readonly promptFeedback?: { readonly blockReason?: string };
  readonly usageMetadata?: {
    readonly promptTokenCount?: number;
    readonly candidatesTokenCount?: number;
    readonly thoughtsTokenCount?: number;
    readonly cachedContentTokenCount?: number;
  };
  readonly error?: {
    readonly code?: number;
    readonly status?: string;
    readonly message?: string;
    readonly details?: ReadonlyArray<{
      readonly '@type'?: string;
      readonly retryDelay?: string;
      readonly violations?: ReadonlyArray<{ readonly quotaMetric?: string }>;
    }>;
  };
}

interface RateLimitInsight {
  readonly is429: boolean;
  readonly isPerDay: boolean;
  readonly retryAfterMs: number;
}

export function createGeminiClient(options: GeminiClientOptions): GeminiClient {
  const httpFetch = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? ENDPOINT_BASE;

  return {
    generate: async (args) => callWithFallback(args, options.apiKey, baseUrl, httpFetch),
  };
}

async function callWithFallback(
  args: GeminiGenerateArgs,
  apiKey: string,
  baseUrl: string,
  httpFetch: typeof fetch,
): Promise<GeminiGenerateResult> {
  try {
    return await singleModelCall(args.modelId, args, apiKey, baseUrl, httpFetch);
  } catch (error) {
    const insight = rateLimitInsight(error);
    if (insight.is429 && args.fallbackModelId) {
      logger.warn(
        { from: args.modelId, to: args.fallbackModelId, isPerDay: insight.isPerDay },
        'cascading to fallback model after 429',
      );
      const fellBackResult = await singleModelCall(
        args.fallbackModelId,
        args,
        apiKey,
        baseUrl,
        httpFetch,
      );
      return { ...fellBackResult, fellBackFrom: args.modelId };
    }
    throw error;
  }
}

async function singleModelCall(
  modelId: string,
  args: GeminiGenerateArgs,
  apiKey: string,
  baseUrl: string,
  httpFetch: typeof fetch,
): Promise<GeminiGenerateResult> {
  const requestBody = buildRequestBody(args);

  const url = `${baseUrl}/${modelId}:generateContent`;

  const raw = await withRetry(async () => sendRequest(httpFetch, url, requestBody, apiKey), {
    attempts: 3,
    baseDelayMs: 500,
    maxDelayMs: 5_000,
    shouldRetry: (error) => {
      // (a) 429 PerMinute — transient quota; retry. PerDay — give up.
      // (b) Any 5xx — Google's own server hiccup ("Internal error encountered",
      //     502/503/504). Their docs explicitly recommend exponential backoff.
      const insight = rateLimitInsight(error);
      if (insight.is429) return !insight.isPerDay;
      if (error instanceof GeminiHttpError && error.status >= 500 && error.status < 600) {
        return true;
      }
      return false;
    },
    operationName: `gemini.${modelId}`,
  });

  const text = raw.candidates?.[0]?.content?.parts?.[0]?.text;
  const finishReason = raw.candidates?.[0]?.finishReason ?? 'UNKNOWN';
  assertCandidateUsable(finishReason, text);

  const usage: TokenUsage = {
    promptTokens: raw.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: raw.usageMetadata?.candidatesTokenCount ?? 0,
    thoughtsTokens: raw.usageMetadata?.thoughtsTokenCount ?? 0,
    cachedInputTokens: raw.usageMetadata?.cachedContentTokenCount ?? 0,
  };

  return {
    text: text as string,
    finishReason,
    modelUsed: modelId,
    usage,
  };
}

function buildRequestBody(args: GeminiGenerateArgs): Record<string, unknown> {
  const config = args.generationConfig ?? {};
  const generationConfig: Record<string, unknown> = {
    temperature: config.temperature ?? 0,
    topP: config.topP ?? 1,
    topK: config.topK ?? 1,
    maxOutputTokens: config.maxOutputTokens ?? 1500,
    responseMimeType: 'application/json',
    responseSchema: args.responseSchema,
  };
  if (config.seed !== undefined) generationConfig.seed = config.seed;
  if (config.thinkingBudget !== undefined) {
    generationConfig.thinkingConfig = { thinkingBudget: config.thinkingBudget };
  }

  return {
    systemInstruction: { parts: [{ text: args.systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: args.userPrompt }] }],
    generationConfig,
    safetySettings: DEFAULT_SAFETY_SETTINGS,
  };
}

class GeminiHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: GeminiResponseShape | undefined,
    public readonly retryAfterMs: number,
    public readonly isPerDayQuota: boolean,
  ) {
    super(body?.error?.message ?? `Gemini HTTP ${status}`);
    this.name = 'GeminiHttpError';
  }
}

async function sendRequest(
  httpFetch: typeof fetch,
  url: string,
  body: Record<string, unknown>,
  apiKey: string,
): Promise<GeminiResponseShape> {
  const response = await httpFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: GeminiResponseShape | undefined;
  try {
    parsed = JSON.parse(text) as GeminiResponseShape;
  } catch {
    parsed = undefined;
  }

  if (!response.ok) {
    const retryInfo = (parsed?.error?.details ?? []).find((detail) =>
      detail['@type']?.includes('RetryInfo'),
    );
    const retryAfterMs = parseRetryDelay(retryInfo?.retryDelay);
    const quotaInfo = (parsed?.error?.details ?? []).find((detail) =>
      detail['@type']?.includes('QuotaFailure'),
    );
    const isPerDayQuota =
      quotaInfo?.violations?.some((violation) =>
        violation.quotaMetric?.toLowerCase().endsWith('perday'),
      ) ?? false;

    throw new GeminiHttpError(response.status, parsed, retryAfterMs, isPerDayQuota);
  }

  if (!parsed) {
    throw new Error('Gemini response is not valid JSON');
  }

  if (parsed.promptFeedback?.blockReason) {
    throw new Error(`Gemini prompt blocked: ${parsed.promptFeedback.blockReason}`);
  }

  return parsed;
}

function parseRetryDelay(delay: string | undefined): number {
  if (!delay) return 1_000;
  const match = delay.match(/^(\d+(?:\.\d+)?)s$/);
  if (!match || match[1] === undefined) return 1_000;
  return Math.floor(Number.parseFloat(match[1]) * 1000);
}

function rateLimitInsight(error: unknown): RateLimitInsight {
  if (error instanceof GeminiHttpError && error.status === 429) {
    return {
      is429: true,
      isPerDay: error.isPerDayQuota,
      retryAfterMs: error.retryAfterMs,
    };
  }
  return { is429: false, isPerDay: false, retryAfterMs: 0 };
}
