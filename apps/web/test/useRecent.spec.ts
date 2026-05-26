import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { RecommendationsQuery } from '@uk-energy/shared';

import { useRecent } from '../src/hooks/useRecent.js';
import type { StoredEntry } from '../src/state/storage.js';

const buildEntry = (id: string, kwh = 40): StoredEntry => ({
  kind: 'recommend',
  id,
  recordedAt: new Date().toISOString(),
  query: {
    goal: 'ev-charge',
    region: 'GB-LON',
    kwh,
    deadline: '2026-05-27T07:00:00.000Z',
    preferences: ['low-carbon'],
  } as RecommendationsQuery,
  preview: { summary: `Result ${id}` },
});

describe('useRecent', () => {
  it('initialises with an empty list when localStorage is fresh', () => {
    const { result } = renderHook(() => useRecent());
    expect(result.current.entries).toEqual([]);
  });

  it('hydrates from existing localStorage entries on mount', () => {
    const seed: StoredEntry[] = [buildEntry('seed-1'), buildEntry('seed-2', 50)];
    window.localStorage.setItem('uk-energy.recent.v2', JSON.stringify(seed));
    const { result } = renderHook(() => useRecent());
    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries[0]?.id).toBe('seed-1');
  });

  it('add() appends a new entry to the head and persists', () => {
    const { result } = renderHook(() => useRecent());
    act(() => result.current.add(buildEntry('a')));
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]?.id).toBe('a');
    expect(JSON.parse(window.localStorage.getItem('uk-energy.recent.v2') ?? '[]')).toHaveLength(1);
  });

  it('add() preserves dedupe semantics from the storage layer', () => {
    const { result } = renderHook(() => useRecent());
    act(() => result.current.add(buildEntry('original')));
    act(() => result.current.add(buildEntry('duplicate'))); // same signature → replaces
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]?.id).toBe('duplicate');
  });

  it('clear() removes both state and localStorage', () => {
    const { result } = renderHook(() => useRecent());
    act(() => result.current.add(buildEntry('a')));
    act(() => result.current.add(buildEntry('b', 50)));
    expect(result.current.entries).toHaveLength(2);
    act(() => result.current.clear());
    expect(result.current.entries).toEqual([]);
    expect(window.localStorage.getItem('uk-energy.recent.v2')).toBeNull();
  });
});
