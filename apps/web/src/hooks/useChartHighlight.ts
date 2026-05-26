import { useMemo } from 'react';

import type { HighlightSpec } from '../components/SimulatedImpactChart/_lib/highlightSpec.js';
import type { LastResult } from '../state/lastResult.js';

export function useChartHighlight(lastResult: LastResult | null): HighlightSpec | null {
  return useMemo(() => {
    if (!lastResult) return null;
    if (lastResult.kind === 'recommend') {
      const top = [...lastResult.data.recommendations].sort((a, b) => a.priority - b.priority)[0];
      if (!top) return null;
      return { kind: 'recommend', window: { start: top.windowStart, end: top.windowEnd } };
    }
    if (lastResult.kind !== 'compare') return null;
    const compareResult = lastResult;
    return {
      kind: 'compare',
      bands: compareResult.data.ranked.map((row, index) => {
        const scenario = compareResult.scenariosSnapshot.find(
          (entry) => entry.id === row.scenarioId,
        );
        return {
          id: row.scenarioId,
          label: `#${index + 1} ${scenario?.label ?? row.scenarioId}`,
          start: scenario?.windowStart ?? '',
          end: scenario?.windowEnd ?? '',
          score: row.score,
        };
      }),
    };
  }, [lastResult]);
}
