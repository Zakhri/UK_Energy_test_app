import { describe, expect, it } from 'vitest';

import { computeConfidence } from '../../src/domain/confidence.js';

describe('computeConfidence', () => {
  it('returns high confidence for fresh, fully-covered, well-cited, valid output', () => {
    const score = computeConfidence({
      dataAgeMinutes: 2,
      requiredFieldsPopulated: 5,
      requiredFieldsTotal: 5,
      citationCount: 3,
      schemaValid: true,
    });
    expect(score.overall).toBeGreaterThanOrEqual(0.9);
    expect(score.recommendation).toBe('use_direct');
    expect(score.caveats).toEqual([]);
  });

  it('returns use_with_caveat for moderate freshness', () => {
    const score = computeConfidence({
      dataAgeMinutes: 20,
      requiredFieldsPopulated: 4,
      requiredFieldsTotal: 5,
      citationCount: 1,
      schemaValid: true,
    });
    expect(score.overall).toBeGreaterThanOrEqual(0.5);
    expect(score.overall).toBeLessThan(0.75);
    expect(score.recommendation).toBe('use_with_caveat');
  });

  it('returns ask_user when context coverage is poor', () => {
    const score = computeConfidence({
      dataAgeMinutes: 10,
      requiredFieldsPopulated: 1,
      requiredFieldsTotal: 5,
      citationCount: 0,
      schemaValid: true,
    });
    expect(score.recommendation).toBe('ask_user');
    expect(score.caveats.some((c) => c.includes('Only 1 of 5'))).toBe(true);
  });

  it('returns fallback_cache when schema invalid and stale', () => {
    const score = computeConfidence({
      dataAgeMinutes: 60,
      requiredFieldsPopulated: 0,
      requiredFieldsTotal: 5,
      citationCount: 0,
      schemaValid: false,
    });
    expect(score.recommendation).toBe('fallback_cache');
    expect(score.overall).toBeLessThan(0.3);
  });

  it('appends external caveats', () => {
    const score = computeConfidence({
      dataAgeMinutes: 2,
      requiredFieldsPopulated: 5,
      requiredFieldsTotal: 5,
      citationCount: 3,
      schemaValid: true,
      externalCaveats: ['Forced caveat'],
    });
    expect(score.caveats).toContain('Forced caveat');
  });

  it('clamps overall score to [0, 1]', () => {
    const score = computeConfidence({
      dataAgeMinutes: 500,
      requiredFieldsPopulated: 0,
      requiredFieldsTotal: 5,
      citationCount: 0,
      schemaValid: false,
    });
    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.overall).toBeLessThanOrEqual(1);
  });
});
