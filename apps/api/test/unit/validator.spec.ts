import { describe, expect, it } from 'vitest';

import { recommendationBundleSchema } from '../../src/schemas/ai-response.js';
import { validateAiOutput } from '../../src/infra/ai/validator.js';

const goodOutput = {
  refused: false,
  summary: 'Charge in the overnight low-demand window for the lowest carbon impact.',
  windowNarratives: [
    {
      id: 'w1',
      reasoning: 'Wind generation peaks overnight per carbon-intensity forecast.',
      tradeoffs: 'Charger must run unattended for 4 hours.',
    },
  ],
  caveats: [],
  citations: ['carbon-intensity', 'open-meteo'],
};

const sourceContext = JSON.stringify({
  windows: [{ id: 'w1', avgCarbonGCo2: 142, avgCostPounds: 0.095 }],
  summary: { priceSource: 'entsoe', dataAgeMinutes: 5 },
});

describe('validateAiOutput', () => {
  it('passes a well-formed explainer response', () => {
    const outcome = validateAiOutput(recommendationBundleSchema, JSON.stringify(goodOutput), {
      sourceContext,
    });
    expect(outcome.schemaValid).toBe(true);
    expect(outcome.value).not.toBeNull();
    expect(outcome.findings.filter((f) => f.code === 'missing-citations')).toHaveLength(0);
  });

  it('reports schemaValid=false for malformed JSON', () => {
    const outcome = validateAiOutput(recommendationBundleSchema, '{not valid', { sourceContext });
    expect(outcome.schemaValid).toBe(false);
    expect(outcome.value).toBeNull();
    expect(outcome.findings.some((finding) => finding.code === 'invalid-json')).toBe(true);
  });

  it('reports schemaValid=false when Zod parse fails (wrong shape)', () => {
    const outcome = validateAiOutput(
      recommendationBundleSchema,
      JSON.stringify({ windowNarratives: 'wrong shape' }),
      { sourceContext },
    );
    expect(outcome.schemaValid).toBe(false);
    expect(outcome.findings.some((finding) => finding.code === 'schema-mismatch')).toBe(true);
  });

  it('flags forbidden phrases like "guaranteed"', () => {
    const bad = {
      ...goodOutput,
      summary: 'You will see guaranteed savings on your bill.',
    };
    const outcome = validateAiOutput(recommendationBundleSchema, JSON.stringify(bad), {
      sourceContext,
    });
    expect(outcome.findings.some((f) => f.code === 'forbidden-phrase')).toBe(true);
  });

  it('flags missing citations when minimum not met', () => {
    const bad = { ...goodOutput, citations: [] };
    const outcome = validateAiOutput(recommendationBundleSchema, JSON.stringify(bad), {
      sourceContext,
      minCitations: 2,
    });
    expect(outcome.findings.some((f) => f.code === 'missing-citations')).toBe(true);
  });

  it('flags unsourced numeric claims in reasoning', () => {
    const bad = {
      ...goodOutput,
      windowNarratives: [
        {
          id: 'w1',
          reasoning: 'Wind generation peaks at 78934 MW overnight.',
          tradeoffs: 'Charger runs unattended.',
        },
      ],
    };
    const outcome = validateAiOutput(recommendationBundleSchema, JSON.stringify(bad), {
      sourceContext,
    });
    expect(outcome.findings.some((f) => f.code === 'numeric-unsourced')).toBe(true);
  });

  it('accepts numbers in prose that appear (±5%) in the source context', () => {
    const ok = {
      ...goodOutput,
      windowNarratives: [
        {
          id: 'w1',
          reasoning:
            'Carbon intensity averages 142 g/kWh in this window — well below the daily peak.',
          tradeoffs: 'Charger runs unattended.',
        },
      ],
    };
    const outcome = validateAiOutput(recommendationBundleSchema, JSON.stringify(ok), {
      sourceContext,
    });
    expect(outcome.findings.some((f) => f.code === 'numeric-unsourced')).toBe(false);
  });

  it('strips clock times from summary/reasoning/tradeoffs and flags it', () => {
    const withClocks = {
      ...goodOutput,
      summary: 'Charge your EV between 03:00 and 05:00 for the lowest carbon impact.',
      windowNarratives: [
        {
          id: 'w1',
          reasoning: 'The cleanest window starts at 03:30 and continues for 4 hours.',
          tradeoffs: 'This is the cleanest period before your 07:00 deadline.',
        },
      ],
    };
    const outcome = validateAiOutput(recommendationBundleSchema, JSON.stringify(withClocks), {
      sourceContext,
    });
    expect(outcome.findings.some((f) => f.code === 'clock-time-in-text')).toBe(true);

    const value = outcome.value!;
    expect(value.summary).not.toMatch(/\d{1,2}:\d{2}/);
    expect(value.windowNarratives[0]?.reasoning).not.toMatch(/\d{1,2}:\d{2}/);
    expect(value.windowNarratives[0]?.tradeoffs).not.toMatch(/\d{1,2}:\d{2}/);
    expect(value.summary.toLowerCase()).toContain('in this window');
    expect(value.windowNarratives[0]?.tradeoffs.toLowerCase()).toContain('before your deadline');
  });

  it('leaves text unchanged when there are no clock times', () => {
    const noClocks = {
      ...goodOutput,
      summary: 'Charge during the overnight low-demand window for the lowest carbon impact.',
    };
    const outcome = validateAiOutput(recommendationBundleSchema, JSON.stringify(noClocks), {
      sourceContext,
    });
    expect(outcome.findings.some((f) => f.code === 'clock-time-in-text')).toBe(false);
    expect(outcome.value?.summary).toBe(noClocks.summary);
  });

  it('accepts a refusal response with empty narrative fields', () => {
    const refused = {
      refused: true,
      refusalReason: 'I only help with UK household electricity scheduling.',
      summary: '',
      windowNarratives: [],
      caveats: [],
      citations: [],
    };
    const outcome = validateAiOutput(recommendationBundleSchema, JSON.stringify(refused), {
      sourceContext,

      minCitations: 0,
    });
    expect(outcome.schemaValid).toBe(true);
    expect(outcome.value?.refused).toBe(true);
  });
});
