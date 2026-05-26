import type { CompareBody, RecommendationsQuery, RegionCode } from '@uk-energy/shared';

import type { ScenarioRow } from '../components/CompareScenarios/index.js';
import type { LastResult } from './lastResult.js';

const STORAGE_KEY = 'uk-energy.recent.v2';
const RECENT_LIMIT = 8;

export type StoredEntry =
  | {
      readonly kind: 'recommend';
      readonly id: string;
      readonly recordedAt: string;
      readonly query: RecommendationsQuery;
      readonly preview: { readonly summary: string };
    }
  | {
      readonly kind: 'compare';
      readonly id: string;
      readonly recordedAt: string;
      readonly query: CompareBody;
      readonly scenariosSnapshot: readonly ScenarioRow[];
      readonly preview: { readonly summary: string };
    }
  | {
      readonly kind: 'trends';
      readonly id: string;
      readonly recordedAt: string;
      readonly query: { readonly region: RegionCode };
      readonly preview: { readonly summary: string };
    };

export function loadRecent(): StoredEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredEntry).slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

export function addRecent(entry: StoredEntry): StoredEntry[] {
  const existing = loadRecent();
  const signature = entrySignature(entry);
  const without = existing.filter((row) => entrySignature(row) !== signature);
  const next = [entry, ...without].slice(0, RECENT_LIMIT);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    void 0;
  }
  return next;
}

export function clearRecent(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    void 0;
  }
}

export function toStoredEntry(result: LastResult): StoredEntry {
  if (result.kind === 'recommend') {
    return {
      kind: 'recommend',
      id: result.id,
      recordedAt: result.recordedAt,
      query: result.query,
      preview: { summary: result.data.summary || 'No summary available' },
    };
  }
  if (result.kind === 'compare') {
    return {
      kind: 'compare',
      id: result.id,
      recordedAt: result.recordedAt,
      query: result.query,
      scenariosSnapshot: result.scenariosSnapshot,
      preview: { summary: result.data.reasoning || 'No summary available' },
    };
  }
  return {
    kind: 'trends',
    id: result.id,
    recordedAt: result.recordedAt,
    query: result.query,
    preview: { summary: result.data.headline || 'No insight available' },
  };
}

function entrySignature(entry: StoredEntry): string {
  if (entry.kind === 'recommend') {
    const q = entry.query;
    return [
      'recommend',
      q.goal,
      q.region,
      q.kwh,
      q.deadline ?? '',
      (q.preferences ?? []).slice().sort().join(','),
      q.note ?? '',
    ].join('|');
  }
  if (entry.kind === 'compare') {
    const q = entry.query;
    const scenarioKey = q.scenarios
      .map((s) => `${s.id}:${s.windowStart}-${s.windowEnd}:${s.kwh}`)
      .sort()
      .join('|');
    return [
      'compare',
      q.region,
      scenarioKey,
      `${q.criteria.goal}:${q.criteria.weights.carbon}/${q.criteria.weights.cost}/${q.criteria.weights.speed}`,
    ].join('||');
  }
  return ['trends', entry.query.region].join('|');
}

function isStoredEntry(value: unknown): value is StoredEntry {
  if (value === null || typeof value !== 'object') return false;
  const record = value as Partial<StoredEntry>;
  if (typeof record.id !== 'string' || typeof record.recordedAt !== 'string') return false;
  if (record.kind !== 'recommend' && record.kind !== 'compare' && record.kind !== 'trends') {
    return false;
  }
  if (typeof record.query !== 'object' || record.query === null) return false;
  if (typeof record.preview !== 'object' || record.preview === null) return false;
  return true;
}
