import { useCallback, useState } from 'react';

import { addRecent, clearRecent, loadRecent, type StoredEntry } from '../state/storage.js';

export interface UseRecentResult {
  readonly entries: readonly StoredEntry[];
  readonly add: (entry: StoredEntry) => void;
  readonly clear: () => void;
}

export function useRecent(): UseRecentResult {
  const [entries, setEntries] = useState<readonly StoredEntry[]>(() =>
    typeof window === 'undefined' ? [] : loadRecent(),
  );

  const add = useCallback((entry: StoredEntry) => {
    setEntries(addRecent(entry));
  }, []);

  const clear = useCallback(() => {
    clearRecent();
    setEntries([]);
  }, []);

  return { entries, add, clear };
}
