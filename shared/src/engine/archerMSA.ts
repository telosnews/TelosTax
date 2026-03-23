import { ArcherMSAInfo, ArcherMSAResult, W2Income } from '../types/index.js';
import { ARCHER_MSA } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate the Archer MSA deduction (Form 8853, Part I).
 *
 * Archer MSAs are legacy medical savings accounts for self-employed individuals
 * and small business employees. No new accounts can be opened after 2007, but
 * existing accounts can still receive contributions.
 *
 * The deduction is limited to a percentage (65% self-only / 75% family) of the
 * HDHP annual deductible, prorated for partial-year coverage.
 *
 * @authority
 *   IRC: Section 220 — Archer MSAs
 *   Form: Form 8853, Schedule 1 Line 8
 * @scope Archer MSA contribution deduction with HDHP-based limits and proration
 * @limitations Distribution taxation (Form 8853 Part II) reuses HSA distribution logic;
 *   does not track whether account was established before 2008 cutoff
 */
export function calculateArcherMSADeduction(
  info: ArcherMSAInfo,
  w2Income: W2Income[],
): ArcherMSAResult {
  const zero: ArcherMSAResult = {
    contributionLimit: 0,
    proratedLimit: 0,
    employerContributions: 0,
    deduction: 0,
    excessContributions: 0,
  };

  if (!info) return zero;

  // Medicare enrollment blocks all contributions
  if (info.isEnrolledInMedicare) return zero;

  // Sum employer contributions from W-2 Box 12 Code R
  const employerContributions = round2(
    w2Income.reduce((sum, w) => {
      const box12R = w.box12?.find(e => e.code === 'R');
      return sum + (box12R?.amount || 0);
    }, 0),
  );

  // Contribution limit based on coverage type and HDHP deductible
  const rate = info.coverageType === 'family' ? ARCHER_MSA.FAMILY_RATE : ARCHER_MSA.SELF_ONLY_RATE;
  const contributionLimit = round2(info.hdhpDeductible * rate);

  // Prorate for partial-year coverage
  const months = Math.max(0, Math.min(12, info.coverageMonths || 12));
  const proratedLimit = round2(contributionLimit * (months / 12));

  // Cannot have both employee and employer contributions in same year
  // If employer contributed, personal contributions are not deductible
  if (employerContributions > 0) {
    // Employer contributions already excluded from W-2 wages
    // Personal contributions would be excess
    const excessContributions = round2(Math.max(0, info.personalContributions || 0));
    return {
      contributionLimit,
      proratedLimit,
      employerContributions,
      deduction: 0,
      excessContributions,
    };
  }

  // Personal contributions deduction, capped at prorated limit
  const personalContributions = Math.max(0, info.personalContributions || 0);
  const deduction = round2(Math.min(personalContributions, proratedLimit));
  const excessContributions = round2(Math.max(0, personalContributions - proratedLimit));

  return {
    contributionLimit,
    proratedLimit,
    employerContributions,
    deduction,
    excessContributions,
  };
}
