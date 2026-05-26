import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useDebugMode } from '../src/hooks/useDebugMode.js';

const originalLocation = window.location;

function setLocation(search: string): void {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, search },
  });
}

describe('useDebugMode', () => {
  beforeEach(() => {
    setLocation('');
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('returns false when no ?debug param is present', () => {
    setLocation('?goal=ev-charge');
    const { result } = renderHook(() => useDebugMode());
    expect(result.current).toBe(false);
  });

  it('returns true when ?debug is present without a value', () => {
    setLocation('?debug');
    const { result } = renderHook(() => useDebugMode());
    expect(result.current).toBe(true);
  });

  it('returns true when ?debug=1', () => {
    setLocation('?debug=1');
    const { result } = renderHook(() => useDebugMode());
    expect(result.current).toBe(true);
  });

  it('returns true when ?debug is mixed with other params', () => {
    setLocation('?region=GB-LON&debug=true&goal=ev-charge');
    const { result } = renderHook(() => useDebugMode());
    expect(result.current).toBe(true);
  });

  it('returns false when no query string at all', () => {
    setLocation('');
    const { result } = renderHook(() => useDebugMode());
    expect(result.current).toBe(false);
  });
});
