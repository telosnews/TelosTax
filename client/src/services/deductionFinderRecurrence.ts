/**
 * Deduction Finder — Recurrence Detection
 *
 * Computes a recurrence score (0-1) for a set of matched transactions
 * belonging to a single pattern. Used to boost scoring for subscription-like
 * patterns (e.g. monthly gym, recurring software charges).
 *
 * Only called when a pattern has `recurrenceRelevant: true`.
 * All processing runs client-side. Data never leaves the browser.
 */

import type { NormalizedTransaction, RecurrencePattern } from './deductionFinderTypes';

/**
 * Compute recurrence pattern from matched transactions for a single pattern.
 * Returns null if fewer than 2 transactions (can't compute intervals).
 */
export function computeRecurrence(
  matchedTxns: NormalizedTransaction[],
): RecurrencePattern | null {
  if (matchedTxns.length < 2) return null;

  // Sort by date ascending
  const sorted = [...matchedTxns].sort((a, b) => a.date.localeCompare(b.date));

  // Count distinct calendar months (YYYY-MM)
  const months = new Set(sorted.map((t) => t.date.slice(0, 7)));
  const monthsActive = months.size;

  // Compute inter-transaction intervals in days
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].date);
    const curr = new Date(sorted[i].date);
    const diffMs = curr.getTime() - prev.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > 0) intervals.push(diffDays);
  }

  if (intervals.length === 0) return null;

  const averageIntervalDays = intervals.reduce((s, d) => s + d, 0) / intervals.length;

  // Compute interval regularity score
  const intervalScore = scoreInterval(averageIntervalDays);

  // Count score: based on distinct months active, saturates at 6 months
  // Uses monthsActive instead of raw txn count to prevent binge purchases
  // (e.g. 12 purchases in one week) from inflating recurrence score
  const countScore = Math.min(monthsActive / 6, 1);

  // Composite: weight interval regularity more than raw count
  const score = 0.6 * intervalScore + 0.4 * countScore;

  return {
    monthsActive,
    averageIntervalDays: Math.round(averageIntervalDays * 10) / 10,
    score: Math.round(score * 100) / 100,
  };
}

/**
 * Score how well an average interval matches known recurring patterns.
 * Weekly (5-9 days), monthly (15-45 days), quarterly (70-110 days).
 */
function scoreInterval(avgDays: number): number {
  // Weekly: 5-9 day intervals
  if (avgDays >= 5 && avgDays <= 9) return 1.0;
  // Biweekly: 12-14 days (no overlap with monthly)
  if (avgDays >= 12 && avgDays <= 14) return 0.9;
  // Monthly: 15-45 day intervals
  if (avgDays >= 15 && avgDays <= 45) return 1.0;
  // Quarterly: 70-110 days
  if (avgDays >= 70 && avgDays <= 110) return 0.7;
  // Semi-annual: 150-200 days
  if (avgDays >= 150 && avgDays <= 200) return 0.5;
  // Annual: 330-400 days
  if (avgDays >= 330 && avgDays <= 400) return 0.3;
  // Irregular
  return 0.1;
}
