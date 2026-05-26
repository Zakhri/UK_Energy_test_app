import { round } from '../../_lib/math.js';
import type { CacheRepository } from '../cache/index.js';
import { isoDay, isoMinute } from '../_lib/time.js';

export interface RateLimiterOptions {
  readonly modelId: string;
  readonly rpmLimit: number;
  readonly rpdLimit: number;
  readonly dailyBudgetUsd: number;
}

export interface RateLimiterDecision {
  readonly allowed: boolean;
  readonly reason?: 'rpm-exceeded' | 'rpd-exceeded' | 'budget-exhausted';
  readonly retryAfterMs?: number;
}

export class RateLimiter {
  constructor(
    private readonly cache: CacheRepository,
    private readonly options: RateLimiterOptions,
  ) {}

  async check(estimatedRequestCostUsd = 0): Promise<RateLimiterDecision> {
    const now = new Date();
    const minute = isoMinute(now);
    const day = isoDay(now);
    const minuteKey = { pk: `RATE#${this.options.modelId}#${minute}`, sk: 'COUNT' };
    const dayKey = { pk: `RATE#${this.options.modelId}#${day}`, sk: 'COUNT' };
    const budgetKey = { pk: `BUDGET#${day}`, sk: 'TOTAL' };

    const [minuteCount, dayCount, budgetTotal] = await Promise.all([
      this.readCount(minuteKey),
      this.readCount(dayKey),
      this.readNumber(budgetKey),
    ]);

    if (minuteCount >= this.options.rpmLimit) {
      const msUntilNextMinute = (60 - now.getUTCSeconds()) * 1000;
      return { allowed: false, reason: 'rpm-exceeded', retryAfterMs: msUntilNextMinute };
    }
    if (dayCount >= this.options.rpdLimit) {
      return { allowed: false, reason: 'rpd-exceeded' };
    }
    if (budgetTotal + estimatedRequestCostUsd > this.options.dailyBudgetUsd) {
      return { allowed: false, reason: 'budget-exhausted' };
    }
    return { allowed: true };
  }

  async record(actualCostUsd: number): Promise<void> {
    const now = new Date();
    const minute = isoMinute(now);
    const day = isoDay(now);
    const minuteKey = { pk: `RATE#${this.options.modelId}#${minute}`, sk: 'COUNT' };
    const dayKey = { pk: `RATE#${this.options.modelId}#${day}`, sk: 'COUNT' };
    const budgetKey = { pk: `BUDGET#${day}`, sk: 'TOTAL' };

    const [minuteCount, dayCount, budgetTotal] = await Promise.all([
      this.readCount(minuteKey),
      this.readCount(dayKey),
      this.readNumber(budgetKey),
    ]);

    await Promise.all([
      this.cache.put(minuteKey, { value: minuteCount + 1 }, 120),
      this.cache.put(dayKey, { value: dayCount + 1 }, 36 * 3600),
      this.cache.put(budgetKey, { value: round(budgetTotal + actualCostUsd, 6) }, 36 * 3600),
    ]);
  }

  private async readCount(key: { pk: string; sk: string }): Promise<number> {
    const entry = await this.cache.get<{ value: number }>(key);
    return entry?.value.value ?? 0;
  }

  private async readNumber(key: { pk: string; sk: string }): Promise<number> {
    const entry = await this.cache.get<{ value: number }>(key);
    return entry?.value.value ?? 0;
  }
}
