import type { PreferenceFlag } from '../../domain/advice.js';
import type { OptimalWindow } from '../../domain/optimal-window.js';

const SLOT_MINUTES = 30;
const PAST_GRACE_MS = 15 * 60_000;
const DEADLINE_GRACE_MS = 30 * 60_000;
const OVERLAP_DEDUPE_THRESHOLD = 0.5;
const DEFAULT_MAX_RESULTS = 3;

const PEAK_START_HOUR_UTC = 16;
const PEAK_END_HOUR_UTC = 20;

export interface CarbonReadingInput {
  readonly from: string;
  readonly intensityGCo2PerKwh: number;
  readonly unreliable?: boolean;
}

export interface PriceReadingInput {
  readonly from: string;

  readonly pricePoundsPerMwh: number;
}

export interface OptimalWindowQuery {
  readonly carbon: readonly CarbonReadingInput[];
  readonly prices?: readonly PriceReadingInput[];
  readonly preferences: readonly PreferenceFlag[];
  readonly durationHours: number;

  readonly deadline?: string;

  readonly maxResults?: number;

  readonly nowMs?: number;
}

interface Candidate {
  readonly windowStartMs: number;
  readonly windowEndMs: number;
  readonly avgCarbon: number;
  readonly avgPrice: number | undefined;
  readonly peakOverlapFraction: number;
}

interface ScoredCandidate extends Candidate {
  readonly score: number;
}

export function findOptimalWindows(query: OptimalWindowQuery): readonly OptimalWindow[] {
  const slotCount = Math.max(1, Math.round((query.durationHours * 60) / SLOT_MINUTES));
  const maxResults = query.maxResults ?? DEFAULT_MAX_RESULTS;
  const nowMs = query.nowMs ?? Date.now();
  const deadlineMs = query.deadline ? Date.parse(query.deadline) : Number.POSITIVE_INFINITY;
  const deadlineCutoffMs = Number.isFinite(deadlineMs)
    ? deadlineMs + DEADLINE_GRACE_MS
    : Number.POSITIVE_INFINITY;

  const reliable = query.carbon.filter((reading) => !reading.unreliable);
  if (reliable.length < slotCount) return [];

  const candidates = buildCandidates(reliable, query.prices, slotCount, nowMs, deadlineCutoffMs);
  if (candidates.length === 0) return [];

  const scored = scoreCandidates(candidates, query.preferences);
  scored.sort((a, b) => b.score - a.score);

  const selected = dedupeOverlapping(scored, maxResults);

  return selected.map((entry, index) => ({
    id: `w${index + 1}`,
    windowStart: new Date(entry.windowStartMs).toISOString(),
    windowEnd: new Date(entry.windowEndMs).toISOString(),
    avgCarbonGCo2: round(entry.avgCarbon, 1),
    avgCostPounds: entry.avgPrice !== undefined ? round(entry.avgPrice / 1000, 4) : undefined,
    score: round(entry.score, 3),
    priority: index + 1,
  }));
}

function buildCandidates(
  reliableCarbon: readonly CarbonReadingInput[],
  prices: readonly PriceReadingInput[] | undefined,
  slotCount: number,
  nowMs: number,
  deadlineCutoffMs: number,
): Candidate[] {
  const candidates: Candidate[] = [];

  for (let i = 0; i <= reliableCarbon.length - slotCount; i++) {
    const slots = reliableCarbon.slice(i, i + slotCount);
    const startMs = Date.parse(slots[0]!.from);
    // Each reading represents the 30 min *starting* at its `from`, so the
    // window's actual end is the last reading's `from` + 30 minutes.
    const endMs = Date.parse(slots[slotCount - 1]!.from) + SLOT_MINUTES * 60_000;

    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
    if (startMs + PAST_GRACE_MS < nowMs) continue;
    if (endMs > deadlineCutoffMs) continue;

    const avgCarbon = mean(slots.map((slot) => slot.intensityGCo2PerKwh));
    const avgPrice = computeAveragePrice(prices, startMs, endMs);
    const peakOverlapFraction = computePeakOverlap(startMs, endMs);

    candidates.push({
      windowStartMs: startMs,
      windowEndMs: endMs,
      avgCarbon,
      avgPrice,
      peakOverlapFraction,
    });
  }

  return candidates;
}

function scoreCandidates(
  candidates: readonly Candidate[],
  preferences: readonly PreferenceFlag[],
): ScoredCandidate[] {
  const carbons = candidates.map((candidate) => candidate.avgCarbon);
  const minCarbon = Math.min(...carbons);
  const maxCarbon = Math.max(...carbons);

  const priceValues = candidates
    .map((candidate) => candidate.avgPrice)
    .filter((price): price is number => price !== undefined);
  const minPrice = priceValues.length > 0 ? Math.min(...priceValues) : 0;
  const maxPrice = priceValues.length > 0 ? Math.max(...priceValues) : 1;

  // No preferences specified → default to low-carbon.
  const effectivePrefs: readonly PreferenceFlag[] =
    preferences.length === 0 ? ['low-carbon'] : preferences;

  return candidates.map((candidate) => {
    const subScores: number[] = [];

    for (const pref of effectivePrefs) {
      switch (pref) {
        case 'low-carbon':
          subScores.push(normalise(candidate.avgCarbon, minCarbon, maxCarbon, /*invert*/ true));
          break;
        case 'low-price':
          if (candidate.avgPrice !== undefined) {
            subScores.push(normalise(candidate.avgPrice, minPrice, maxPrice, /*invert*/ true));
          } else {
            subScores.push(0.5);
          }
          break;
        case 'avoid-peak':
          subScores.push(1 - candidate.peakOverlapFraction);
          break;
        case 'fast-completion':
          // Earlier window = better. Normalise position [0, candidates.length).
          subScores.push(
            1 -
              (candidate.windowStartMs - candidates[0]!.windowStartMs) /
                Math.max(
                  1,
                  candidates[candidates.length - 1]!.windowStartMs - candidates[0]!.windowStartMs,
                ),
          );
          break;
      }
    }

    const score = subScores.length > 0 ? mean(subScores) : 0.5;
    return { ...candidate, score };
  });
}

function dedupeOverlapping(
  sorted: readonly ScoredCandidate[],
  maxResults: number,
): ScoredCandidate[] {
  const selected: ScoredCandidate[] = [];
  for (const candidate of sorted) {
    if (selected.length >= maxResults) break;
    const overlapsExisting = selected.some(
      (kept) => overlapFraction(candidate, kept) > OVERLAP_DEDUPE_THRESHOLD,
    );
    if (!overlapsExisting) selected.push(candidate);
  }
  return selected;
}

function overlapFraction(a: Candidate, b: Candidate): number {
  const overlapMs = Math.max(
    0,
    Math.min(a.windowEndMs, b.windowEndMs) - Math.max(a.windowStartMs, b.windowStartMs),
  );
  const shorterMs = Math.min(a.windowEndMs - a.windowStartMs, b.windowEndMs - b.windowStartMs);
  return shorterMs > 0 ? overlapMs / shorterMs : 0;
}

function computeAveragePrice(
  prices: readonly PriceReadingInput[] | undefined,
  windowStartMs: number,
  windowEndMs: number,
): number | undefined {
  if (!prices || prices.length === 0) return undefined;

  const matching: number[] = [];
  for (const point of prices) {
    const slotStartMs = Date.parse(point.from);
    if (!Number.isFinite(slotStartMs)) continue;
    const slotEndMs = slotStartMs + SLOT_MINUTES * 60_000;
    if (slotEndMs <= windowStartMs || slotStartMs >= windowEndMs) continue;
    matching.push(point.pricePoundsPerMwh);
  }

  return matching.length > 0 ? mean(matching) : undefined;
}

function computePeakOverlap(windowStartMs: number, windowEndMs: number): number {
  const durationMs = windowEndMs - windowStartMs;
  if (durationMs <= 0) return 0;

  let overlapMs = 0;
  // Walk day-by-day in case the window crosses midnight.
  const startDay = floorToUtcDay(windowStartMs);
  const endDay = floorToUtcDay(windowEndMs);
  for (let day = startDay; day <= endDay; day += 24 * 60 * 60_000) {
    const peakStart = day + PEAK_START_HOUR_UTC * 60 * 60_000;
    const peakEnd = day + PEAK_END_HOUR_UTC * 60 * 60_000;
    const overlap = Math.max(
      0,
      Math.min(windowEndMs, peakEnd) - Math.max(windowStartMs, peakStart),
    );
    overlapMs += overlap;
  }

  return overlapMs / durationMs;
}

function floorToUtcDay(ms: number): number {
  return Math.floor(ms / (24 * 60 * 60_000)) * 24 * 60 * 60_000;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalise(value: number, min: number, max: number, invert: boolean): number {
  if (max - min < 1e-9) return 1;
  const normalised = (value - min) / (max - min);
  return invert ? 1 - normalised : normalised;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
