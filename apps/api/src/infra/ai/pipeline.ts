import type { z } from 'zod';

import type { AdviceRequest, RankedScenario, ScenarioCriteria } from '../../domain/advice.js';
import type { ConfidenceScore } from '../../domain/confidence.js';
import { computeConfidence } from '../../domain/confidence.js';
import { AiRefusedError, BudgetExhaustedError, RateLimitedError } from '../../domain/errors.js';
import type { OptimalWindow } from '../../domain/optimal-window.js';
import { getPromptRegistry } from '../../prompts/registry.js';
import type {
  CompareResultParsed,
  RecommendationBundleParsed,
  TrendsInsightParsed,
} from '../../schemas/ai-response.js';
import {
  compareResultGeminiSchema,
  compareResultSchema,
  recommendationBundleGeminiSchema,
  recommendationBundleSchema,
  trendsInsightGeminiSchema,
  trendsInsightSchema,
} from '../../schemas/ai-response.js';
import type { TrendSummary } from '../../application/_lib/compute-trends.js';
import type { CacheRepository } from '../cache/index.js';
import { logger } from '../logger.js';
import { buildAiCacheKey, readAiCache, writeAiCache } from './cache.js';
import type { GeminiClient } from './gemini.client.js';
import { inspectNote } from './guard.js';
import { estimateCostUsd } from './pricing.js';
import type { RateLimiter } from './rate-limiter.js';
import type { TelemetryRecorder } from './telemetry.js';
import { validateAiOutput, type ValidationOutcome } from './validator.js';

export interface PipelineEnvelope<T> {
  readonly payload: T;
  readonly confidence: ConfidenceScore;
  readonly meta: PipelineMeta;
}

export interface PipelineMeta {
  readonly requestId: string;
  readonly modelUsed: string;
  readonly promptVersion: string;
  readonly promptHash: string;
  readonly latencyMs: number;
  readonly costUsd: number;
  readonly cacheHit: boolean;
  readonly degraded: boolean;
  readonly fallbackUsed?: string;
}

export interface PipelineDeps {
  readonly cache: CacheRepository;
  readonly gemini: GeminiClient;
  readonly rateLimiter: RateLimiter;
  readonly telemetry: TelemetryRecorder;
  readonly modelId: string;

  readonly fallbackModelId?: string;
  readonly cacheTtlSeconds?: number;
}

export interface ContextSummary {
  readonly priceSource: 'entsoe' | 'synthetic';
  readonly oldestDataAgeMinutes: number;
  readonly unreliableCarbonCount: number;

  readonly contextSourcesPresent: number;
}

export interface CompareInputs {
  readonly region: string;
  readonly criteria: ScenarioCriteria;
}

export class AiPipeline {
  constructor(private readonly deps: PipelineDeps) {}

  async generateRecommendations(
    request: AdviceRequest,
    optimalWindows: readonly OptimalWindow[],
    summary: ContextSummary,
    requestId: string,
  ): Promise<PipelineEnvelope<RecommendationBundleParsed>> {
    const guarded = inspectNote(request.note);
    const registry = getPromptRegistry();

    const windowsJson = JSON.stringify(optimalWindows);
    const summaryJson = JSON.stringify(buildContextSummaryForAi(summary));

    const userPrompt = registry.render('recommendations.user', {
      goal: request.goal,
      region: request.region,
      kwhRequired: request.kwhRequired,
      deadline: request.deadline ?? 'no explicit deadline',
      preferences: request.preferences.join(', ') || 'none specified',
      note: guarded.sanitisedNote,
      windowsJson,
      contextSummaryJson: summaryJson,
    });

    return this.executeStage({
      requestId,
      registry,
      userPrompt,

      sourceContext: `${windowsJson}\n${summaryJson}`,
      contextAgeMinutes: summary.oldestDataAgeMinutes,
      contextSourcesPresent: summary.contextSourcesPresent,
      requiredFieldsTotal: 5,
      requiredFieldsPopulated: countPopulatedRequiredFields(request),
      schema: recommendationBundleSchema,
      geminiResponseSchema: recommendationBundleGeminiSchema,
      cacheKeyInput: {
        promptVersion: registry.version,
        promptHash: registry.hash,
        modelId: this.deps.modelId,
        // The narrative for the same window set + same user inputs is
        // stable, so we key on those rather than the upstream forecast.
        // Excludes priceSource/age/unreliableCount which can churn within
        // a 15-min bucket and would defeat the cache otherwise.
        contentJson: stableJson({
          kind: 'recommend',
          request: requestForCacheKey(request),
          windows: windowsForCacheKey(optimalWindows),
        }),
      },
    });
  }

  async compareScenarios(
    inputs: CompareInputs,
    rankedScenarios: readonly RankedScenario[],
    summary: ContextSummary,
    requestId: string,
  ): Promise<PipelineEnvelope<CompareResultParsed>> {
    const registry = getPromptRegistry();

    const rankedJson = JSON.stringify(rankedScenarios);
    const summaryJson = JSON.stringify(buildContextSummaryForAi(summary));

    const userPrompt = registry.render('compare.user', {
      goal: inputs.criteria.goal,
      region: inputs.region,
      weights: inputs.criteria.weights,
      rankedJson,
      contextSummaryJson: summaryJson,
    });

    return this.executeStage({
      requestId,
      registry,
      userPrompt,
      sourceContext: `${rankedJson}\n${summaryJson}`,
      contextAgeMinutes: summary.oldestDataAgeMinutes,
      contextSourcesPresent: summary.contextSourcesPresent,
      requiredFieldsTotal: 4,
      requiredFieldsPopulated: 4,
      schema: compareResultSchema,
      geminiResponseSchema: compareResultGeminiSchema,
      cacheKeyInput: {
        promptVersion: registry.version,
        promptHash: registry.hash,
        modelId: this.deps.modelId,
        contentJson: stableJson({
          kind: 'compare',
          inputs,
          ranked: rankedScenarios,
        }),
      },
    });
  }

  /**
   * Trends-insight stage (F18.2) — backend already computed the today-vs-
   * 7-day delta; the AI writes a headline + explanation + drivers tying
   * the numbers to today's weather conditions. Backend owns the numbers,
   * AI owns the prose — same split as the recommend/compare flows.
   */
  async generateTrendsInsight(
    region: string,
    trends: TrendSummary,
    weatherSnapshot: { todayAvgWindMps: number; todayAvgTempC: number },
    summary: ContextSummary,
    requestId: string,
  ): Promise<PipelineEnvelope<TrendsInsightParsed>> {
    const registry = getPromptRegistry();

    const trendsJson = JSON.stringify(trends);
    const weatherJson = JSON.stringify(weatherSnapshot);
    const summaryJson = JSON.stringify(buildContextSummaryForAi(summary));

    const userPrompt = registry.render('trends.user', {
      region,
      trendsJson,
      weatherJson,
      contextSummaryJson: summaryJson,
    });

    return this.executeStage({
      requestId,
      registry,
      userPrompt,
      sourceContext: `${trendsJson}\n${weatherJson}\n${summaryJson}`,
      contextAgeMinutes: summary.oldestDataAgeMinutes,
      contextSourcesPresent: summary.contextSourcesPresent,
      requiredFieldsTotal: 3,
      requiredFieldsPopulated: 3,
      schema: trendsInsightSchema,
      geminiResponseSchema: trendsInsightGeminiSchema,
      cacheKeyInput: {
        promptVersion: registry.version,
        promptHash: registry.hash,
        modelId: this.deps.modelId,
        contentJson: stableJson({
          kind: 'trends',
          region,
          today: Math.round(trends.todayAvgGCo2 * 10) / 10,
          week: Math.round(trends.weekAvgGCo2 * 10) / 10,
          verdict: trends.verdict,
        }),
      },
      cacheTtlSeconds: 60 * 60,
    });
  }

  private async executeStage<T>(stage: StageInputs<T>): Promise<PipelineEnvelope<T>> {
    const startedAt = Date.now();
    const cacheKey = buildAiCacheKey(stage.cacheKeyInput);

    // L2: cache hit short-circuit
    const cached = await readAiCache<PipelineCachedEntry<T>>(this.deps.cache, cacheKey);
    if (cached) {
      const elapsed = Date.now() - startedAt;
      await this.deps.telemetry.record({
        requestId: stage.requestId,
        modelId: cached.modelUsed,
        promptVersion: stage.registry.version,
        promptHash: stage.registry.hash,
        latencyMs: elapsed,
        promptTokens: 0,
        outputTokens: 0,
        thoughtsTokens: 0,
        cachedInputTokens: 0,
        costUsd: 0,
        cacheHit: true,
        schemaValid: true,
        refused: cached.payload && (cached.payload as { refused?: boolean }).refused === true,
        degraded: cached.degraded,
        confidenceOverall: cached.confidence.overall,
      });
      return {
        payload: cached.payload,
        confidence: cached.confidence,
        meta: {
          ...cached.meta,
          requestId: stage.requestId,
          latencyMs: elapsed,
          cacheHit: true,
        },
      };
    }

    // L2: budget + rate check
    const decision = await this.deps.rateLimiter.check();
    if (!decision.allowed) {
      const errorClass = decision.reason === 'budget-exhausted' ? 'BudgetExhausted' : 'RateLimited';
      await this.deps.telemetry.record({
        requestId: stage.requestId,
        modelId: this.deps.modelId,
        promptVersion: stage.registry.version,
        promptHash: stage.registry.hash,
        latencyMs: Date.now() - startedAt,
        promptTokens: 0,
        outputTokens: 0,
        thoughtsTokens: 0,
        cachedInputTokens: 0,
        costUsd: 0,
        cacheHit: false,
        schemaValid: false,
        refused: false,
        degraded: true,
        confidenceOverall: 0,
        errorClass,
      });
      if (decision.reason === 'budget-exhausted') {
        throw new BudgetExhaustedError('Daily AI budget reached');
      }
      throw new RateLimitedError(`AI rate limit hit (${decision.reason})`, {
        retryAfterMs: decision.retryAfterMs,
      });
    }

    // L3: model call
    const geminiResult = await this.deps.gemini.generate({
      modelId: this.deps.modelId,
      ...(this.deps.fallbackModelId ? { fallbackModelId: this.deps.fallbackModelId } : {}),
      systemInstruction: stage.registry.templates.system,
      userPrompt: stage.userPrompt,
      responseSchema: stage.geminiResponseSchema as Readonly<Record<string, unknown>>,
      generationConfig: {
        temperature: 0,
        topP: 1,
        topK: 1,
        seed: 42,
        // Explainer mode produces shorter output than the old picker mode
        // (no per-window numeric fields), but keep the safety margin —
        // 3.1 Lite occasionally pads with extra caveats.
        maxOutputTokens: 4000,
      },
    });

    // L4: deterministic validator
    const outcome: ValidationOutcome<T> = validateAiOutput(stage.schema, geminiResult.text, {
      sourceContext: stage.sourceContext,
    });

    if (!outcome.schemaValid || !outcome.value) {
      logger.warn(
        { requestId: stage.requestId, findings: outcome.findings },
        'validator rejected output',
      );
      throw new AiRefusedError('AI output failed validation', {
        findings: outcome.findings,
      });
    }

    // L5: confidence
    const citationCount = countCitations(outcome.value);
    const confidence = computeConfidence({
      dataAgeMinutes: stage.contextAgeMinutes,
      requiredFieldsPopulated: stage.requiredFieldsPopulated,
      requiredFieldsTotal: stage.requiredFieldsTotal,
      citationCount,
      schemaValid: outcome.schemaValid,
      externalCaveats: outcome.findings.map((finding) => finding.detail),
    });

    const refused = isRefusedPayload(outcome.value);
    const costUsd = estimateCostUsd(geminiResult.modelUsed, geminiResult.usage);
    await this.deps.rateLimiter.record(costUsd);

    // L6: telemetry + cache write
    const meta: PipelineMeta = {
      requestId: stage.requestId,
      modelUsed: geminiResult.modelUsed,
      promptVersion: stage.registry.version,
      promptHash: stage.registry.hash,
      latencyMs: Date.now() - startedAt,
      costUsd,
      cacheHit: false,
      degraded: geminiResult.fellBackFrom !== undefined,
      ...(geminiResult.fellBackFrom ? { fallbackUsed: geminiResult.fellBackFrom } : {}),
    };

    await this.deps.telemetry.record({
      requestId: stage.requestId,
      modelId: geminiResult.modelUsed,
      promptVersion: stage.registry.version,
      promptHash: stage.registry.hash,
      latencyMs: meta.latencyMs,
      promptTokens: geminiResult.usage.promptTokens,
      outputTokens: geminiResult.usage.outputTokens,
      thoughtsTokens: geminiResult.usage.thoughtsTokens,
      cachedInputTokens: geminiResult.usage.cachedInputTokens,
      costUsd,
      cacheHit: false,
      schemaValid: outcome.schemaValid,
      refused,
      degraded: meta.degraded,
      confidenceOverall: confidence.overall,
      ...(geminiResult.fellBackFrom ? { fallbackUsed: geminiResult.fellBackFrom } : {}),
    });

    if (!refused) {
      await writeAiCache<PipelineCachedEntry<T>>(
        this.deps.cache,
        cacheKey,
        {
          payload: outcome.value,
          confidence,
          modelUsed: geminiResult.modelUsed,
          degraded: meta.degraded,
          meta,
        },
        stage.cacheTtlSeconds ?? this.deps.cacheTtlSeconds ?? 15 * 60,
      );
    }

    return { payload: outcome.value, confidence, meta };
  }
}

interface StageInputs<T> {
  readonly requestId: string;
  readonly registry: ReturnType<typeof getPromptRegistry>;
  readonly userPrompt: string;
  readonly sourceContext: string;
  readonly contextAgeMinutes: number;
  readonly contextSourcesPresent: number;
  readonly requiredFieldsTotal: number;
  readonly requiredFieldsPopulated: number;
  readonly schema: z.ZodSchema<T>;
  readonly geminiResponseSchema: Readonly<Record<string, unknown>>;
  readonly cacheKeyInput: Parameters<typeof buildAiCacheKey>[0];
  readonly cacheTtlSeconds?: number;
}

interface PipelineCachedEntry<T> {
  readonly payload: T;
  readonly confidence: ConfidenceScore;
  readonly modelUsed: string;
  readonly degraded: boolean;
  readonly meta: PipelineMeta;
}

function buildContextSummaryForAi(summary: ContextSummary): Record<string, unknown> {
  return {
    priceSource: summary.priceSource,
    dataAgeMinutes: Math.round(summary.oldestDataAgeMinutes),
    unreliableCarbonReadingsExcluded: summary.unreliableCarbonCount,
  };
}

function countPopulatedRequiredFields(request: AdviceRequest): number {
  let count = 0;
  if (request.goal) count += 1;
  if (request.region) count += 1;
  if (request.kwhRequired > 0) count += 1;
  if (request.deadline) count += 1;
  if (request.preferences.length > 0) count += 1;
  return count;
}

function countCitations(payload: unknown): number {
  if (!payload || typeof payload !== 'object') return 0;
  const citations = (payload as { citations?: unknown }).citations;
  return Array.isArray(citations) ? new Set(citations as unknown[]).size : 0;
}

function isRefusedPayload(payload: unknown): boolean {
  return Boolean(
    payload && typeof payload === 'object' && (payload as { refused?: unknown }).refused,
  );
}

/**
 * Strip the per-call note from the cache key. Note text is sanitised but
 * varies per request — including it would defeat caching for repeat queries
 * that differ only in user note. (The note still flows into the AI prompt;
 * the cache key just doesn't pin to it.)
 */
function requestForCacheKey(request: AdviceRequest): Omit<AdviceRequest, 'note'> {
  const { note: _note, ...rest } = request;
  return rest;
}

/** Cache key keeps only the stable window identifiers + numeric facts. */
function windowsForCacheKey(
  windows: readonly OptimalWindow[],
): ReadonlyArray<Pick<OptimalWindow, 'id' | 'windowStart' | 'windowEnd' | 'avgCarbonGCo2'>> {
  return windows.map((window) => ({
    id: window.id,
    windowStart: window.windowStart,
    windowEnd: window.windowEnd,
    avgCarbonGCo2: window.avgCarbonGCo2,
  }));
}

/**
 * Stable JSON — deterministic serialisation regardless of object key order, so
 * structurally-equal payloads always hash to the same cache key.
 *
 * Must use the replacer FUNCTION form: passing an array of property names to
 * `JSON.stringify` would treat it as an allowlist applied at EVERY depth,
 * silently dropping any nested key not in the top-level set. That bug was
 * present here from launch and caused the AI cache to collide every request
 * (region/goal/preferences all stripped → identical key → always cache hit).
 */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, val: unknown) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const source = val as Record<string, unknown>;
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(source).sort()) {
        sorted[key] = source[key];
      }
      return sorted;
    }
    return val;
  });
}
