import { useMemo } from 'react';

export function useDebugMode(): boolean {
  return useMemo(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug'),
    [],
  );
}
