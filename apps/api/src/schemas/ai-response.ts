import { z } from 'zod';

const citationEnum = z.enum(['carbon-intensity', 'open-meteo', 'entsoe', 'synthetic-prices']);

export const windowNarrativeSchema = z.object({
  id: z.string().min(1).max(8),
  reasoning: z.string().max(1500),
  tradeoffs: z.string().max(1000),
});

export const recommendationBundleSchema = z.object({
  refused: z.boolean(),
  refusalReason: z.string().optional(),
  summary: z.string().max(2000),
  windowNarratives: z.array(windowNarrativeSchema).max(5),
  caveats: z.array(z.string()).max(10),
  citations: z.array(citationEnum).min(0).max(4),
});

export type RecommendationBundleParsed = z.infer<typeof recommendationBundleSchema>;

export const scenarioRationaleSchema = z.object({
  scenarioId: z.string().min(1).max(64),
  rationale: z.string().max(1000),
});

export const compareResultSchema = z.object({
  refused: z.boolean(),
  refusalReason: z.string().optional(),
  scenarioRationales: z.array(scenarioRationaleSchema).max(10),
  reasoning: z.string().max(2000),
  caveats: z.array(z.string()).max(10),
  citations: z.array(citationEnum).min(0).max(4),
});

export type CompareResultParsed = z.infer<typeof compareResultSchema>;

export const trendsInsightSchema = z.object({
  refused: z.boolean(),
  refusalReason: z.string().optional(),
  headline: z.string().max(200),
  explanation: z.string().max(800),
  drivers: z.array(z.string().max(220)).max(4),
  caveats: z.array(z.string()).max(10),
  citations: z.array(citationEnum).min(0).max(4),
});

export type TrendsInsightParsed = z.infer<typeof trendsInsightSchema>;

export const recommendationBundleGeminiSchema = {
  type: 'object',
  properties: {
    refused: { type: 'boolean' },
    refusalReason: { type: 'string' },
    summary: { type: 'string' },
    windowNarratives: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          reasoning: { type: 'string' },
          tradeoffs: { type: 'string' },
        },
        required: ['id', 'reasoning', 'tradeoffs'],
      },
    },
    caveats: { type: 'array', items: { type: 'string' } },
    citations: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['carbon-intensity', 'open-meteo', 'entsoe', 'synthetic-prices'],
      },
    },
  },
  required: ['refused', 'summary', 'windowNarratives', 'caveats', 'citations'],
} as const;

export const compareResultGeminiSchema = {
  type: 'object',
  properties: {
    refused: { type: 'boolean' },
    refusalReason: { type: 'string' },
    scenarioRationales: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          scenarioId: { type: 'string' },
          rationale: { type: 'string' },
        },
        required: ['scenarioId', 'rationale'],
      },
    },
    reasoning: { type: 'string' },
    caveats: { type: 'array', items: { type: 'string' } },
    citations: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['carbon-intensity', 'open-meteo', 'entsoe', 'synthetic-prices'],
      },
    },
  },
  required: ['refused', 'scenarioRationales', 'reasoning', 'caveats', 'citations'],
} as const;

export const trendsInsightGeminiSchema = {
  type: 'object',
  properties: {
    refused: { type: 'boolean' },
    refusalReason: { type: 'string' },
    headline: { type: 'string' },
    explanation: { type: 'string' },
    drivers: { type: 'array', items: { type: 'string' } },
    caveats: { type: 'array', items: { type: 'string' } },
    citations: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['carbon-intensity', 'open-meteo', 'entsoe', 'synthetic-prices'],
      },
    },
  },
  required: ['refused', 'headline', 'explanation', 'drivers', 'caveats', 'citations'],
} as const;
