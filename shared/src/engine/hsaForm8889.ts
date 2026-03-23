import { HSAContributionInfo } from '../types/index.js';
import { HSA } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate HSA deduction using full Form 8889 logic.
 *
 * Form 8889 computes the allowable HSA deduction:
 *   Deduction = min(totalContributions, contributionLimit) - employerContributions
 *
 * Contribution limits (2025):
 *   Self-only:  $4,300
 *   Family:     $8,550
 *   Catch-up:   +$1,000 if age 55+
 *
 * Partial-year proration (Form 8889 Line 6 Limitation Worksheet):
 *   If HDHP coverage was not for the full year, the base annual limit is prorated:
 *     Prorated limit = (months of coverage / 12) × annual limit
 *   Per IRS Form 8889 instructions, the catch-up amount ($1,000 for age 55+)
 *   is NOT prorated — it is a flat addition to Line 7 if eligible for any month.
 *
 * Employer contributions (W-2 Box 12, Code W) reduce the deductible amount
 * since they're already excluded from income.
 *
 * @authority
 *   IRC: Section 223 — health savings accounts
 *   IRC: Section 223(b)(2) — monthly limitation / proration
 *   Rev. Proc: 2024-25 — HSA contribution limits
 *   Form: Form 8889 Line 6 Limitation Chart and Worksheet
 * @scope HSA contribution deduction with limits, proration, and employer offset
 * @limitations Does not implement the "last month rule" (IRC §223(b)(8)) which
 *   allows full-year contribution if eligible on Dec 1 (with testing period requirement).
 */
export function calculateHSADeduction(info: HSAContributionInfo): number {
  if (!info || !info.totalContributions || info.totalContributions <= 0) return 0;

  const baseLimit = info.coverageType === 'family'
    ? HSA.FAMILY_LIMIT
    : HSA.INDIVIDUAL_LIMIT;

  // Prorate base limit for partial-year HDHP coverage (Form 8889 Line 6 Worksheet)
  const months = Math.min(12, Math.max(1, info.hdhpCoverageMonths ?? 12));
  const proratedLimit = months === 12 ? baseLimit : round2(baseLimit * months / 12);

  // Catch-up: flat $1,000 (not prorated) per Form 8889 Line 7 instructions
  // IRC §223(b)(3): Only eligible if age 55+ by end of tax year
  let catchUpAmount = 0;
  if ((info.catchUpContributions || 0) > 0) {
    if (info.dateOfBirth && info.taxYear) {
      const age = getAgeAtEndOfYear(info.dateOfBirth, info.taxYear);
      catchUpAmount = (age !== null && age >= 55) ? HSA.CATCH_UP_55_PLUS : 0;
    } else {
      // No date of birth provided — trust the user's input
      catchUpAmount = HSA.CATCH_UP_55_PLUS;
    }
  }
  const effectiveLimit = proratedLimit + catchUpAmount;

  // Cap contributions at the limit
  const allowable = Math.min(info.totalContributions, effectiveLimit);

  // Subtract employer contributions (already excluded from income)
  const employerContrib = Math.max(0, info.employerContributions || 0);
  const deduction = Math.max(0, allowable - employerContrib);

  return round2(deduction);
}

/** Parse a date string and compute age at end of the given tax year. */
function getAgeAtEndOfYear(dateOfBirth: string, taxYear: number): number | null {
  // Support formats: YYYY-MM-DD, MM/DD/YYYY, etc.
  const parts = dateOfBirth.includes('-')
    ? dateOfBirth.split('-').map(Number)
    : dateOfBirth.split('/').map(Number);
  if (parts.length < 3) return null;

  const [a, , ] = parts;
  // YYYY-MM-DD vs MM/DD/YYYY
  const year = a > 1900 ? a : parts[2];
  if (!year || isNaN(year)) return null;

  return taxYear - year;
}
