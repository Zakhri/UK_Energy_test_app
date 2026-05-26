import { describe, expect, it } from 'vitest';

import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatPounds,
  formatTime,
} from '../src/lib/format.js';

describe('lib/format', () => {
  describe('formatTime', () => {
    it('formats an ISO string to en-GB 24h HH:MM', () => {
      // 14:30 UTC — assertion is jurisdiction-tolerant but expects HH:MM shape
      expect(formatTime('2026-05-26T14:30:00.000Z')).toMatch(/^\d{2}:\d{2}$/);
    });

    it('degrades to "Invalid Date" when given an unparseable string (toLocaleTimeString does not throw)', () => {
      expect(formatTime('not-a-date')).toBe('Invalid Date');
    });
  });

  describe('formatDate', () => {
    it('formats an ISO string to en-GB short month + 2-digit day', () => {
      expect(formatDate('2026-05-26T14:30:00.000Z')).toMatch(/^\d{2} \w{3}$/);
    });
  });

  describe('formatDateTime', () => {
    it('combines date + time separated by a single space', () => {
      const result = formatDateTime('2026-05-26T14:30:00.000Z');
      expect(result).toMatch(/^\d{2} \w{3} \d{2}:\d{2}$/);
    });
  });

  describe('formatNumber', () => {
    it('returns 0-decimal integer formatting by default', () => {
      expect(formatNumber(1234)).toBe('1,234');
    });

    it('respects the decimals argument', () => {
      expect(formatNumber(1234.5, 1)).toBe('1,234.5');
      expect(formatNumber(0.123, 3)).toBe('0.123');
    });
  });

  describe('formatPounds', () => {
    it('prefixes the value with £ and uses 2 decimals by default', () => {
      expect(formatPounds(12.5)).toBe('£12.50');
    });

    it('respects custom decimal precision', () => {
      expect(formatPounds(0.0008, 4)).toBe('£0.0008');
    });
  });
});
