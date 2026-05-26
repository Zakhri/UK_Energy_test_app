import type { ScenarioRow } from '../types.js';

export const DEFAULT_KWH = 40;

export const DEFAULT_WEIGHTS = { carbon: 0.6, cost: 0.4, speed: 0 } as const;

export function buildStarterScenarios(): ScenarioRow[] {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const dateStr = tomorrow.toISOString().slice(0, 10);
  const at = (hh: string): string => `${dateStr}T${hh}`;
  return [
    {
      id: 'overnight',
      label: 'Overnight (02:00–06:00)',
      windowStart: at('02:00'),
      windowEnd: at('06:00'),
      kwh: DEFAULT_KWH,
    },
    {
      id: 'morning',
      label: 'Morning (08:00–12:00)',
      windowStart: at('08:00'),
      windowEnd: at('12:00'),
      kwh: DEFAULT_KWH,
    },
    {
      id: 'evening',
      label: 'Evening peak (18:00–22:00)',
      windowStart: at('18:00'),
      windowEnd: at('22:00'),
      kwh: DEFAULT_KWH,
    },
  ];
}
