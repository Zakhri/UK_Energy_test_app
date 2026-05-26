import { describe, expect, it } from 'vitest';
import type { CompareBody, RecommendationsQuery } from '@uk-energy/shared';

import {
  addRecent,
  clearRecent,
  loadRecent,
  toStoredEntry,
  type StoredEntry,
} from '../src/state/storage.js';
import type { RecommendResult, CompareResult, TrendsResult } from '../src/state/lastResult.js';

const buildRecommendQuery = (
  overrides: Partial<RecommendationsQuery> = {},
): RecommendationsQuery => ({
  goal: 'ev-charge',
  region: 'GB-LON',
  kwh: 40,
  deadline: '2026-05-27T07:00:00.000Z',
  preferences: ['low-carbon'],
  ...overrides,
});

const buildRecommendEntry = (
  id: string,
  overrides: Partial<RecommendationsQuery> = {},
): StoredEntry => ({
  kind: 'recommend',
  id,
  recordedAt: new Date().toISOString(),
  query: buildRecommendQuery(overrides),
  preview: { summary: `Result ${id}` },
});

const buildTrendsEntry = (id: string, region = 'GB-LON' as const): StoredEntry => ({
  kind: 'trends',
  id,
  recordedAt: new Date().toISOString(),
  query: { region },
  preview: { summary: `Trends ${id}` },
});

describe('state/storage', () => {
  describe('loadRecent', () => {
    it('returns [] when storage is empty', () => {
      expect(loadRecent()).toEqual([]);
    });

    it('returns [] when storage contains malformed JSON', () => {
      window.localStorage.setItem('uk-energy.recent.v2', '{not-valid');
      expect(loadRecent()).toEqual([]);
    });

    it('filters out entries that do not match the StoredEntry shape', () => {
      const valid = buildRecommendEntry('1');
      const invalid = { kind: 'recommend', id: 42, recordedAt: 'now' };
      window.localStorage.setItem('uk-energy.recent.v2', JSON.stringify([valid, invalid]));
      const loaded = loadRecent();
      expect(loaded).toHaveLength(1);
      expect(loaded[0]?.id).toBe('1');
    });

    it('returns [] when stored value is not an array', () => {
      window.localStorage.setItem('uk-energy.recent.v2', JSON.stringify({ foo: 'bar' }));
      expect(loadRecent()).toEqual([]);
    });
  });

  describe('addRecent', () => {
    it('persists a new entry to localStorage', () => {
      const entry = buildRecommendEntry('a');
      const result = addRecent(entry);
      expect(result).toEqual([entry]);
      expect(loadRecent()).toEqual([entry]);
    });

    it('prepends the newest entry to the front', () => {
      const first = buildRecommendEntry('1');
      const second = buildRecommendEntry('2', { region: 'GB-SCO' });
      addRecent(first);
      const result = addRecent(second);
      expect(result.map((e) => e.id)).toEqual(['2', '1']);
    });

    it('dedupes identical recommend queries — same signature drops the older one', () => {
      const a = buildRecommendEntry('first-id');
      const b = buildRecommendEntry('second-id'); // same query → same signature
      addRecent(a);
      const result = addRecent(b);
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('second-id');
    });

    it('does NOT dedupe when preferences differ (signature-sensitive)', () => {
      addRecent(buildRecommendEntry('1', { preferences: ['low-carbon'] }));
      const result = addRecent(buildRecommendEntry('2', { preferences: ['low-cost'] }));
      expect(result).toHaveLength(2);
    });

    it('dedupes preferences in any order (signature sorts them)', () => {
      addRecent(buildRecommendEntry('1', { preferences: ['low-carbon', 'avoid-peak'] }));
      const result = addRecent(
        buildRecommendEntry('2', { preferences: ['avoid-peak', 'low-carbon'] }),
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('2');
    });

    it('truncates to RECENT_LIMIT (8) entries', () => {
      for (let i = 0; i < 12; i += 1) {
        addRecent(buildRecommendEntry(`id-${i}`, { kwh: i + 1 })); // unique kWh → unique signature
      }
      const final = loadRecent();
      expect(final).toHaveLength(8);
      expect(final[0]?.id).toBe('id-11');
      expect(final[7]?.id).toBe('id-4');
    });

    it('dedupes trends entries by region', () => {
      addRecent(buildTrendsEntry('t1', 'GB-LON'));
      const result = addRecent(buildTrendsEntry('t2', 'GB-LON'));
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('t2');
    });

    it('keeps separate trends entries for different regions', () => {
      addRecent(buildTrendsEntry('t1', 'GB-LON'));
      const result = addRecent(buildTrendsEntry('t2', 'GB-SCO'));
      expect(result).toHaveLength(2);
    });
  });

  describe('clearRecent', () => {
    it('wipes localStorage entries', () => {
      addRecent(buildRecommendEntry('1'));
      addRecent(buildRecommendEntry('2', { region: 'GB-SCO' }));
      expect(loadRecent()).toHaveLength(2);
      clearRecent();
      expect(loadRecent()).toEqual([]);
    });
  });

  describe('toStoredEntry', () => {
    it('maps a RecommendResult → recommend StoredEntry with summary preview', () => {
      const result: RecommendResult = {
        kind: 'recommend',
        id: 'r1',
        recordedAt: '2026-05-26T12:00:00.000Z',
        query: buildRecommendQuery(),
        data: {
          summary: 'Charge between 02:00 and 06:00.',
          recommendations: [],
          confidence: {} as never,
          caveats: [],
          citations: [],
          meta: {} as never,
        } as never,
      };
      const stored = toStoredEntry(result);
      expect(stored.kind).toBe('recommend');
      expect(stored.preview.summary).toBe('Charge between 02:00 and 06:00.');
    });

    it('falls back to "No summary available" when summary is empty', () => {
      const result: RecommendResult = {
        kind: 'recommend',
        id: 'r2',
        recordedAt: '2026-05-26T12:00:00.000Z',
        query: buildRecommendQuery(),
        data: { summary: '' } as never,
      };
      expect(toStoredEntry(result).preview.summary).toBe('No summary available');
    });

    it('maps a TrendsResult → trends StoredEntry using headline as preview', () => {
      const result: TrendsResult = {
        kind: 'trends',
        id: 't1',
        recordedAt: '2026-05-26T12:00:00.000Z',
        query: { region: 'GB-LON' },
        data: { headline: 'Today is greener than last week.' } as never,
      };
      const stored = toStoredEntry(result);
      expect(stored.kind).toBe('trends');
      expect(stored.preview.summary).toBe('Today is greener than last week.');
    });

    it('maps a CompareResult → compare StoredEntry using reasoning as preview + keeps scenarios snapshot', () => {
      const compareBody: CompareBody = {
        scenarios: [],
        region: 'GB-LON',
        criteria: { goal: 'low-carbon', weights: { carbon: 1, cost: 0, speed: 0 } },
      } as never;
      const result: CompareResult = {
        kind: 'compare',
        id: 'c1',
        recordedAt: '2026-05-26T12:00:00.000Z',
        query: compareBody,
        scenariosSnapshot: [{ id: 's1' } as never],
        data: { reasoning: 'Scenario A wins on carbon.' } as never,
      };
      const stored = toStoredEntry(result);
      expect(stored.kind).toBe('compare');
      if (stored.kind === 'compare') {
        expect(stored.preview.summary).toBe('Scenario A wins on carbon.');
        expect(stored.scenariosSnapshot).toHaveLength(1);
      }
    });
  });
});
