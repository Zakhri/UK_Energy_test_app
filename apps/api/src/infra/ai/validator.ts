import type { z } from 'zod';

const FORBIDDEN_PHRASES: readonly RegExp[] = [
  /\bguaranteed\b/i,
  /\b100% accurate\b/i,
  /\b100% (?:certain|sure)\b/i,
  /\bzero risk\b/i,
  /\bbest deal possible\b/i,
];

export interface ValidationFinding {
  readonly code:
    | 'missing-citations'
    | 'forbidden-phrase'
    | 'numeric-unsourced'
    | 'schema-mismatch'
    | 'invalid-json'
    | 'clock-time-in-text';
  readonly detail: string;
}

export interface ValidationOutcome<T> {
  readonly schemaValid: boolean;
  readonly value: T | null;
  readonly findings: readonly ValidationFinding[];
}

export interface ValidateOptions {
  readonly sourceContext: string;

  readonly minCitations?: number;
}

export function validateAiOutput<T>(
  schema: z.ZodSchema<T>,
  rawText: string,
  options: ValidateOptions,
): ValidationOutcome<T> {
  const findings: ValidationFinding[] = [];

  const parsedJson = tryParseJson(rawText);
  if (!parsedJson.success) {
    findings.push({
      code: 'invalid-json',
      detail: `Could not JSON.parse the model output (first 120 chars: ${rawText.slice(0, 120)})`,
    });
    return { schemaValid: false, value: null, findings };
  }

  const parsed = schema.safeParse(parsedJson.value);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(' | ');
    findings.push({
      code: 'schema-mismatch',
      detail: `Zod rejected model output (${parsed.error.issues.length} issue(s)): ${issues}`,
    });
    return { schemaValid: false, value: null, findings };
  }

  const cleaned = parsed.data;
  scanForbiddenPhrases(cleaned, findings);
  enforceCitations(cleaned, findings, options.minCitations ?? 1);
  verifyNumericGrounding(cleaned, options.sourceContext, findings);
  stripClockTimesFromFreeText(cleaned, findings);

  return { schemaValid: true, value: cleaned, findings };
}

function tryParseJson(raw: string): { success: true; value: unknown } | { success: false } {
  try {
    return { success: true, value: JSON.parse(raw) };
  } catch {
    return { success: false };
  }
}

function scanForbiddenPhrases<T>(value: T, findings: ValidationFinding[]): void {
  walk(value, (node) => {
    if (typeof node !== 'string') return;
    for (const pattern of FORBIDDEN_PHRASES) {
      if (pattern.test(node)) {
        findings.push({
          code: 'forbidden-phrase',
          detail: `Output contains forbidden phrase matching /${pattern.source}/i`,
        });
      }
    }
  });
}

function enforceCitations<T>(value: T, findings: ValidationFinding[], minCitations: number): void {
  const record = value as { citations?: unknown };
  const citations = Array.isArray(record.citations) ? record.citations : [];
  if (citations.length < minCitations) {
    findings.push({
      code: 'missing-citations',
      detail: `Expected at least ${minCitations} citation(s), got ${citations.length}`,
    });
  }
}

/**
 * Cheap grounding check: every numeric claim in the model's user-facing text
 * fields (`summary`, `reasoning`, `tradeoffs`, `rationale`) must appear (±5%)
 * in the source context the model received.
 *
 * We deliberately walk ONLY those four field names — not the whole payload —
 * because:
 *   - Date/time fields contain numbers (year, month, day) that aren't claims.
 *   - The model's reasoning is where hallucination matters most; structured
 *     numeric fields are now backend-owned (not at risk).
 *   - We also pre-strip ISO-8601-shaped substrings to avoid matching them.
 */
const GROUNDABLE_FIELDS = new Set(['summary', 'reasoning', 'tradeoffs', 'rationale']);
const ISO_DATE_PATTERN = /\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?Z?)?/g;

function verifyNumericGrounding<T>(
  value: T,
  sourceContext: string,
  findings: ValidationFinding[],
): void {
  const numbersInContext = extractNumbers(sourceContext);
  if (numbersInContext.length === 0) return;

  walkFields(value, GROUNDABLE_FIELDS, (text) => {
    const dateStripped = text.replace(ISO_DATE_PATTERN, ' ');
    const claims = extractNumbers(dateStripped);
    for (const claim of claims) {
      const grounded = numbersInContext.some((sourceNumber) =>
        withinTolerance(claim, sourceNumber, 0.05),
      );
      if (!grounded) {
        findings.push({
          code: 'numeric-unsourced',
          detail: `Claim "${claim}" does not appear (±5%) in source context`,
        });
        return; // one finding per field is enough
      }
    }
  });
}

function extractNumbers(text: string): number[] {
  const matches = text.match(/-?\d+(?:\.\d+)?/g);
  if (!matches) return [];
  return matches
    .map((match) => Number.parseFloat(match))
    .filter(
      (value) => Number.isFinite(value) && Math.abs(value) > 0.5 && Math.abs(value) < 100_000,
    );
}

function walkFields(
  value: unknown,
  fieldNames: ReadonlySet<string>,
  visit: (text: string) => void,
): void {
  if (Array.isArray(value)) {
    for (const item of value) walkFields(item, fieldNames, visit);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (fieldNames.has(key) && typeof child === 'string') {
        visit(child);
      } else {
        walkFields(child, fieldNames, visit);
      }
    }
  }
}

function withinTolerance(a: number, b: number, fraction: number): boolean {
  if (a === b) return true;
  const denominator = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / denominator <= fraction;
}

function walk(value: unknown, visit: (node: unknown) => void): void {
  visit(value);
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) walk(child, visit);
  }
}

/**
 * Belt-and-braces protection against the AI quoting `HH:MM` clock times in
 * `summary` / `reasoning` / `tradeoffs` free text.
 *
 * Why this exists even though the v1 system prompt forbids it: AI compliance
 * with style rules is statistical, not deterministic. The user-facing impact
 * of a slip is severe — the model writes "before 03:00" (a UTC string) while
 * the UI renders `windowStart` in local time, and the two disagree by the
 * user's TZ offset. End-state: user thinks the recommendation is broken.
 *
 * Approach: rewrite the offending substrings using narrow, grammar-aware
 * patterns (preserve readability), then flag a single finding when any
 * substitution fired. We MUTATE the value in place — these fields are part
 * of the cleaned `parsed.data` we return; the caller doesn't keep a
 * pre-clean reference.
 */
const CLOCK_TIME_FIELDS = new Set(['summary', 'reasoning', 'tradeoffs', 'rationale']);

function stripClockTimesFromFreeText<T>(value: T, findings: ValidationFinding[]): void {
  let anyHit = false;
  mutateFields(value, CLOCK_TIME_FIELDS, (text) => {
    const result = sanitiseClockTimesInText(text);
    if (result.hadClockTimes) anyHit = true;
    return result.cleaned;
  });
  if (anyHit) {
    findings.push({
      code: 'clock-time-in-text',
      detail:
        'AI free text quoted specific HH:MM clock times — UTC values would mismatch the user-local UI render. Rewritten with abstract references.',
    });
  }
}

/**
 * Rewrite known phrases first (preserves grammar), then fall back to a
 * generic replacement for bare clock times. Order matters — match the
 * longest, most specific patterns first.
 */
export function sanitiseClockTimesInText(text: string): {
  cleaned: string;
  hadClockTimes: boolean;
} {
  let cleaned = text;
  let hadClockTimes = false;
  const replace = (pattern: RegExp, replacement: string): void => {
    if (pattern.test(cleaned)) {
      hadClockTimes = true;
      cleaned = cleaned.replace(pattern, replacement);
    }
  };

  replace(/\bbetween\s+\d{1,2}:\d{2}\s+and\s+\d{1,2}:\d{2}\b/gi, 'in this window');
  replace(/\bfrom\s+\d{1,2}:\d{2}\s+to\s+\d{1,2}:\d{2}\b/gi, 'during this window');
  replace(/\b\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}\b/g, 'this window');
  replace(/\bbefore\s+(?:your\s+)?\d{1,2}:\d{2}\s+deadline\b/gi, 'before your deadline');
  replace(/\bbefore\s+\d{1,2}:\d{2}\b/gi, 'before your deadline');
  replace(/\bafter\s+\d{1,2}:\d{2}\b/gi, 'later in the day');
  replace(/\bby\s+\d{1,2}:\d{2}\b/gi, 'by your deadline');
  replace(/\bstarting\s+at\s+\d{1,2}:\d{2}\b/gi, 'starting in this window');
  replace(/\bat\s+\d{1,2}:\d{2}\b/gi, 'at this time');
  replace(/\baround\s+\d{1,2}:\d{2}\b/gi, 'around this time');
  replace(/\bthe\s+\d{1,2}:\d{2}\s+(slot|window|period|hour)\b/gi, 'this $1');
  replace(/\b\d{1,2}:\d{2}\b/g, 'this window');

  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  return { cleaned, hadClockTimes };
}

/**
 * Mutating sibling of `walkFields` — calls `visit(text)` and writes the
 * returned string back into the parent object.
 */
function mutateFields(
  value: unknown,
  fieldNames: ReadonlySet<string>,
  visit: (text: string) => string,
): void {
  if (Array.isArray(value)) {
    for (const item of value) mutateFields(item, fieldNames, visit);
    return;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const [key, child] of Object.entries(record)) {
      if (fieldNames.has(key) && typeof child === 'string') {
        record[key] = visit(child);
      } else {
        mutateFields(child, fieldNames, visit);
      }
    }
  }
}
