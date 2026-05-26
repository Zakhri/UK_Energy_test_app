/**
 * Regression guard for the race condition fixed in F24: when a flow hook's
 * `onResult` callback identity changed (e.g. because the parent's `useRecent`
 * added a new entry → state changed → new callback ref), the effect was
 * re-firing and pushing the SAME data into the result handler again. The fix:
 * a `liftedDataRef` short-circuit inside the effect. This test asserts that
 * a stable `data` value never leads to more than ONE `onResult` invocation,
 * even when the callback identity changes between renders.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { TrendsInsightResponse } from '@uk-energy/shared';

import { useTrendsFlow } from '../src/hooks/useTrendsFlow.js';

const mutateSpy = vi.fn();
let mockReturn: {
  data: TrendsInsightResponse | null;
  error: null;
  isPending: boolean;
  mutate: typeof mutateSpy;
};

vi.mock('../src/hooks/useTrends.js', () => ({
  useTrendsMutation: () => mockReturn,
}));

const fakeTrend = (overrides: Partial<TrendsInsightResponse> = {}): TrendsInsightResponse =>
  ({
    headline: 'Today is greener than last week.',
    refused: false,
    ...overrides,
  }) as TrendsInsightResponse;

describe('useTrendsFlow — idempotency guard', () => {
  beforeEach(() => {
    mutateSpy.mockReset();
    mockReturn = { data: null, error: null, isPending: false, mutate: mutateSpy };
  });

  it('fires onResult exactly once when data arrives', () => {
    const onResult = vi.fn();
    const { result, rerender } = renderHook(({ cb }) => useTrendsFlow({ onResult: cb }), {
      initialProps: { cb: onResult },
    });

    // 1. user triggers a run
    act(() => result.current.run('GB-LON'));
    expect(mutateSpy).toHaveBeenCalledWith('GB-LON');

    // 2. data arrives — simulate by changing the mocked return + forcing re-render
    mockReturn = { ...mockReturn, data: fakeTrend() };
    rerender({ cb: onResult });

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0]?.[0]?.kind).toBe('trends');
    expect(onResult.mock.calls[0]?.[0]?.query.region).toBe('GB-LON');
  });

  it('does NOT re-fire onResult when only the callback identity changes (regression guard)', () => {
    const firstCb = vi.fn();
    const secondCb = vi.fn();
    const { rerender, result } = renderHook(({ cb }) => useTrendsFlow({ onResult: cb }), {
      initialProps: { cb: firstCb },
    });

    act(() => result.current.run('GB-LON'));
    const trendData = fakeTrend();
    mockReturn = { ...mockReturn, data: trendData };
    rerender({ cb: firstCb });
    expect(firstCb).toHaveBeenCalledTimes(1);

    // Simulating the parent's `handleResult` getting a fresh identity:
    // before the fix this would have called secondCb with the same trendData.
    rerender({ cb: secondCb });
    expect(secondCb).toHaveBeenCalledTimes(0);
    expect(firstCb).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire onResult when refused: true comes back', () => {
    const onResult = vi.fn();
    const { rerender, result } = renderHook(({ cb }) => useTrendsFlow({ onResult: cb }), {
      initialProps: { cb: onResult },
    });

    act(() => result.current.run('GB-LON'));
    mockReturn = { ...mockReturn, data: fakeTrend({ refused: true }) };
    rerender({ cb: onResult });

    expect(onResult).not.toHaveBeenCalled();
  });

  it('autoLoadRegion fires a single mutate on mount', () => {
    const onResult = vi.fn();
    renderHook(() => useTrendsFlow({ onResult, autoLoadRegion: 'GB-LON' }));
    expect(mutateSpy).toHaveBeenCalledTimes(1);
    expect(mutateSpy).toHaveBeenCalledWith('GB-LON');
  });

  it('autoLoadRegion does NOT re-fire mutate on rerender (didAutoLoadRef guard)', () => {
    const onResult = vi.fn();
    const { rerender } = renderHook(
      ({ region }) => useTrendsFlow({ onResult, autoLoadRegion: region }),
      { initialProps: { region: 'GB-LON' as const } },
    );
    expect(mutateSpy).toHaveBeenCalledTimes(1);

    rerender({ region: 'GB-LON' });
    rerender({ region: 'GB-LON' });
    expect(mutateSpy).toHaveBeenCalledTimes(1); // still 1, not 3
  });
});
