/**
 * Regression guard for `useRecommendationFlow.liftedDataRef` — same shape as
 * `useTrendsFlow.spec.tsx`, applied to the streaming recommendation hook.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { RecommendationsQuery, RecommendationsResponse } from '@uk-energy/shared';

import { useRecommendationFlow } from '../src/hooks/useRecommendationFlow.js';
import type { RecommendationStage } from '../src/hooks/useStreamingRecommendations.js';

const triggerSpy = vi.fn();
let mockReturn: {
  data: RecommendationsResponse | null;
  error: null;
  isPending: boolean;
  stage: RecommendationStage;
  trigger: typeof triggerSpy;
  reset: () => void;
};

vi.mock('../src/hooks/useStreamingRecommendations.js', () => ({
  useStreamingRecommendations: () => mockReturn,
}));

const fakeQuery = (): RecommendationsQuery => ({
  goal: 'ev-charge',
  region: 'GB-LON',
  kwh: 40,
  deadline: '2026-05-27T07:00:00.000Z',
  preferences: ['low-carbon'],
});

const fakeRecommendation = (): RecommendationsResponse =>
  ({
    summary: 'Charge between 02:00 and 06:00.',
    refused: false,
    recommendations: [],
    confidence: { overall: 0.9 },
    caveats: [],
    citations: [],
    meta: { requestId: 'test', costUsd: 0.001 },
  }) as never;

describe('useRecommendationFlow — idempotency guard', () => {
  beforeEach(() => {
    triggerSpy.mockReset();
    mockReturn = {
      data: null,
      error: null,
      isPending: false,
      stage: 'idle',
      trigger: triggerSpy,
      reset: () => undefined,
    };
  });

  it('fires onResult once when data arrives', () => {
    const onResult = vi.fn();
    const { rerender, result } = renderHook(({ cb }) => useRecommendationFlow({ onResult: cb }), {
      initialProps: { cb: onResult },
    });

    act(() => result.current.run(fakeQuery()));
    expect(triggerSpy).toHaveBeenCalledTimes(1);

    mockReturn = { ...mockReturn, data: fakeRecommendation() };
    rerender({ cb: onResult });

    expect(onResult).toHaveBeenCalledTimes(1);
    const arg = onResult.mock.calls[0]?.[0];
    expect(arg?.kind).toBe('recommend');
    expect(arg?.query.goal).toBe('ev-charge');
  });

  it('does NOT re-fire onResult on callback-identity change (regression)', () => {
    const cbA = vi.fn();
    const cbB = vi.fn();
    const { rerender, result } = renderHook(({ cb }) => useRecommendationFlow({ onResult: cb }), {
      initialProps: { cb: cbA },
    });

    act(() => result.current.run(fakeQuery()));
    mockReturn = { ...mockReturn, data: fakeRecommendation() };
    rerender({ cb: cbA });
    expect(cbA).toHaveBeenCalledTimes(1);

    rerender({ cb: cbB });
    expect(cbB).toHaveBeenCalledTimes(0);
    expect(cbA).toHaveBeenCalledTimes(1);
  });

  it('skips onResult when refused: true', () => {
    const onResult = vi.fn();
    const { rerender, result } = renderHook(({ cb }) => useRecommendationFlow({ onResult: cb }), {
      initialProps: { cb: onResult },
    });

    act(() => result.current.run(fakeQuery()));
    mockReturn = {
      ...mockReturn,
      data: { ...fakeRecommendation(), refused: true } as never,
    };
    rerender({ cb: onResult });

    expect(onResult).not.toHaveBeenCalled();
  });
});
