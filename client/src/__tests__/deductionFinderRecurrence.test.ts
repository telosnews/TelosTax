/**
 * Deduction Finder Recurrence Detection — Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { computeRecurrence } from '../services/deductionFinderRecurrence';
import type { NormalizedTransaction } from '../services/deductionFinderTypes';

function makeTxn(date: string, amount = 100, row = 1): NormalizedTransaction {
  return { date, description: `TXN ${date}`, amount, originalRow: row };
}

describe('computeRecurrence', () => {
  it('returns null for fewer than 2 transactions', () => {
    expect(computeRecurrence([])).toBeNull();
    expect(computeRecurrence([makeTxn('2025-01-15')])).toBeNull();
  });

  it('detects monthly recurrence (high score)', () => {
    // 6 monthly transactions
    const txns = [
      makeTxn('2025-01-15'),
      makeTxn('2025-02-15'),
      makeTxn('2025-03-15'),
      makeTxn('2025-04-15'),
      makeTxn('2025-05-15'),
      makeTxn('2025-06-15'),
    ];
    const result = computeRecurrence(txns)!;
    expect(result).not.toBeNull();
    expect(result.monthsActive).toBe(6);
    expect(result.averageIntervalDays).toBeCloseTo(30, 0);
    // Interval score = 1.0 (monthly), count score = 6/6 = 1.0
    // Composite = 0.6 * 1.0 + 0.4 * 1.0 = 1.0
    expect(result.score).toBe(1.0);
  });

  it('detects weekly recurrence', () => {
    const txns = Array.from({ length: 8 }, (_, i) => {
      const d = new Date(2025, 0, 6 + i * 7); // Every Monday
      return makeTxn(d.toISOString().slice(0, 10));
    });
    const result = computeRecurrence(txns)!;
    expect(result).not.toBeNull();
    expect(result.averageIntervalDays).toBe(7);
    expect(result.score).toBeGreaterThan(0.6);
  });

  it('detects quarterly recurrence', () => {
    const txns = [
      makeTxn('2025-01-15'),
      makeTxn('2025-04-15'),
      makeTxn('2025-07-15'),
      makeTxn('2025-10-15'),
    ];
    const result = computeRecurrence(txns)!;
    expect(result).not.toBeNull();
    expect(result.averageIntervalDays).toBeCloseTo(91, 1);
    // Interval score = 0.7 (quarterly), count score = 4 months / 6 ≈ 0.67
    // Composite = 0.6 * 0.7 + 0.4 * 0.67 ≈ 0.69
    expect(result.score).toBeGreaterThan(0.6);
    expect(result.score).toBeLessThan(0.8);
  });

  it('gives low score for irregular intervals', () => {
    // 2 transactions only, ~120 days apart — doesn't fit any standard interval
    const txns = [
      makeTxn('2025-01-05'),
      makeTxn('2025-05-05'),  // ~120 days — between quarterly and semi-annual
    ];
    const result = computeRecurrence(txns)!;
    expect(result).not.toBeNull();
    // interval 120 days → doesn't match weekly/monthly/quarterly bands → intervalScore 0.1
    // 2 months active → countScore = 2/6 ≈ 0.33
    // composite: 0.6 * 0.1 + 0.4 * 0.33 ≈ 0.19
    expect(result.score).toBeLessThan(0.3);
  });

  it('saturates count score at 6 distinct months', () => {
    // 6 monthly = saturated count (monthsActive=6, countScore=1.0)
    const txns6 = Array.from({ length: 6 }, (_, i) =>
      makeTxn(`2025-${String(i + 1).padStart(2, '0')}-15`),
    );
    const r6 = computeRecurrence(txns6)!;

    // 8 monthly = same count score (still saturated at 6)
    const txns8 = [
      ...txns6,
      makeTxn('2025-07-15'),
      makeTxn('2025-08-15'),
    ];
    const r8 = computeRecurrence(txns8)!;

    // Both have maxed count score; difference only in interval averaging
    expect(r6.score).toBeCloseTo(r8.score, 1);
  });

  it('handles unsorted input', () => {
    const txns = [
      makeTxn('2025-06-15'),
      makeTxn('2025-01-15'),
      makeTxn('2025-03-15'),
    ];
    const result = computeRecurrence(txns)!;
    expect(result).not.toBeNull();
    expect(result.monthsActive).toBe(3);
  });

  it('binge purchases in one month do not inflate recurrence score', () => {
    // 12 purchases in one week — only 1 month active
    const txns = Array.from({ length: 12 }, (_, i) =>
      makeTxn(`2025-01-${String(i + 1).padStart(2, '0')}`),
    );
    const result = computeRecurrence(txns)!;
    expect(result).not.toBeNull();
    expect(result.monthsActive).toBe(1);
    // countScore = 1/6 ≈ 0.17, intervalScore = 1.0 (daily ≈ irregular = 0.1 actually)
    // Score should be low — not above the 0.3 bonus threshold
    expect(result.score).toBeLessThan(0.3);
  });

  it('handles same-day transactions (0-day intervals ignored)', () => {
    const txns = [
      makeTxn('2025-01-15', 50),
      makeTxn('2025-01-15', 75),
      makeTxn('2025-02-15', 50),
    ];
    const result = computeRecurrence(txns)!;
    expect(result).not.toBeNull();
    // Only 1 non-zero interval (31 days) from Jan 15 → Feb 15
    expect(result.monthsActive).toBe(2);
  });
});
