import type { ScenarioRow } from '../types.js';

export function refreshScenarioDates(scenarios: readonly ScenarioRow[]): ScenarioRow[] {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDateStr = formatLocalDate(tomorrow);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);
  const dayAfterDateStr = formatLocalDate(dayAfter);

  return scenarios.map((scenario) => {
    const startTime = extractTime(scenario.windowStart);
    const endTime = extractTime(scenario.windowEnd);
    if (!startTime || !endTime) return scenario;

    const startsAtOrBefore = compareTimes(startTime, endTime) <= 0;
    const newStart = `${tomorrowDateStr}T${startTime}`;
    const newEnd = `${startsAtOrBefore ? tomorrowDateStr : dayAfterDateStr}T${endTime}`;
    return { ...scenario, windowStart: newStart, windowEnd: newEnd };
  });
}

function extractTime(datetimeLocal: string): string | null {
  // Accept both "YYYY-MM-DDTHH:mm" (form value) and ISO UTC "YYYY-MM-DDTHH:mm:ssZ".
  const match = datetimeLocal.match(/T(\d{2}:\d{2})/);
  return match ? match[1]! : null;
}

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** -1 if a < b, 0 if equal, 1 if a > b. Both "HH:MM". */
function compareTimes(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
