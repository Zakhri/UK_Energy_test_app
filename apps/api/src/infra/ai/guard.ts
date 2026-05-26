import { ValidationError } from '../../domain/errors.js';

const PROMPT_INJECTION_PATTERNS: readonly RegExp[] = [
  /ignore (?:all )?(?:previous|above) (?:instructions|prompts|rules)/i,
  /disregard the (?:above|previous|system) (?:instructions|prompt|rules)/i,
  /system prompt[:=]/i,
  /<\/?user_input>/i,
  /<\/?context>/i,
  /you are now (?:a |an )?\w+/i,
  /assistant: ?\n?ok i'?ll/i, // simulated chat injection
  /act as (?:a |an )?(?:admin|root|developer mode|jailbreak)/i,
];

const UK_POSTCODE_PATTERN = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}\b/g;

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_PATTERN = /\+?\d[\d\s\-()]{8,}\d/g;

export interface GuardConfig {
  readonly maxInputChars: number;
}

export interface GuardResult {
  readonly sanitisedNote: string;
  readonly redactionsApplied: number;
}

const DEFAULT_CONFIG: GuardConfig = { maxInputChars: 4000 };

export function inspectNote(
  rawNote: string | undefined,
  config: Partial<GuardConfig> = {},
): GuardResult {
  if (!rawNote) {
    return { sanitisedNote: '', redactionsApplied: 0 };
  }

  const effective = { ...DEFAULT_CONFIG, ...config };

  if (rawNote.length > effective.maxInputChars) {
    throw new ValidationError(`Note exceeds ${effective.maxInputChars} characters`, {
      actual: rawNote.length,
      max: effective.maxInputChars,
    });
  }

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(rawNote)) {
      // SECURITY: do NOT leak which pattern matched — an attacker would use the
      // response to systematically enumerate the blacklist and craft a bypass.
      throw new ValidationError('Note contains a disallowed instruction pattern', {
        code: 'PROMPT_INJECTION',
      });
    }
  }

  let redactions = 0;
  let sanitised = rawNote.replace(UK_POSTCODE_PATTERN, (_match, outward: string) => {
    redactions += 1;
    return `${outward} ███`;
  });
  sanitised = sanitised.replace(EMAIL_PATTERN, () => {
    redactions += 1;
    return '[email-redacted]';
  });
  sanitised = sanitised.replace(PHONE_PATTERN, () => {
    redactions += 1;
    return '[phone-redacted]';
  });

  return { sanitisedNote: sanitised, redactionsApplied: redactions };
}

/**
 * Verify a Gemini response candidate is structurally usable.
 * Throws if SAFETY blocked, truncated, or empty.
 */
export function assertCandidateUsable(
  finishReason: string | undefined,
  text: string | undefined,
): void {
  if (finishReason === 'SAFETY' || finishReason === 'PROHIBITED_CONTENT') {
    throw new ValidationError('Gemini safety filter blocked the response', {
      finishReason,
    });
  }
  if (finishReason === 'MAX_TOKENS') {
    throw new ValidationError('Gemini response truncated by token limit', {
      finishReason,
    });
  }
  if (!text || text.trim().length === 0) {
    throw new ValidationError('Gemini returned empty response', {
      finishReason: finishReason ?? 'unknown',
    });
  }
}
