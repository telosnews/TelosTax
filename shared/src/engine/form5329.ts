/**
 * Form 5329 — Additional Taxes on Qualified Retirement Plans
 *
 * Part I:  Early distribution penalty (10% on distributions with code 1).
 *          Supports IRC §72(t)(2) partial exceptions — when the 1099-R has
 *          distribution code 1 but the taxpayer qualifies for an exception
 *          (education, first-time homebuyer, medical, etc.), the exception
 *          amount is subtracted before applying the 10% penalty.
 *          Also includes SECURE 2.0 emergency personal expense exemption
 *          (IRC §72(t)(2)(I)) — up to $1,000/year penalty-free.
 *
 * Part V:  Excess contribution penalties (6% excise on IRA/HSA excess).
 *
 * @scope Current-year excess contributions and early distribution penalties.
 * @limitations Does not model correction windows (withdrawal before tax filing
 *   deadline to avoid penalty), prior-year carryforward of uncorrected excess,
 *   or interaction with returned contributions. Documented as simplified
 *   implementation.
 * @authority
 *   IRC §4973(a) — IRA excess contributions
 *   IRC §4973(g) — HSA excess contributions
 *   IRC §72(t)(1) — 10% early withdrawal penalty
 *   IRC §72(t)(2) — Exceptions to early distribution penalty
 *   IRC §72(t)(2)(I) — SECURE 2.0 emergency personal expense exception
 */

import {
  ExcessContributionInfo,
  EmergencyDistributionInfo,
  Form5329Result,
  Income1099R,
} from '../types/index.js';
import { EXCESS_CONTRIBUTION, EARLY_DISTRIBUTION, EMERGENCY_DISTRIBUTION } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate Form 5329 penalties: early distribution penalty + excess contribution excise.
 *
 * @param excessContributions - IRA/HSA excess contribution amounts
 * @param income1099R - All 1099-R distributions (for early distribution penalty)
 * @param emergencyDistributions - SECURE 2.0 emergency distribution info
 */
export function calculateForm5329(
  excessContributions: ExcessContributionInfo,
  income1099R?: Income1099R[],
  emergencyDistributions?: EmergencyDistributionInfo,
): Form5329Result {
  // Part V: Excess contribution penalties (6%)
  const iraExcess = Math.max(0, excessContributions.iraExcessContribution || 0);
  const hsaExcess = Math.max(0, excessContributions.hsaExcessContribution || 0);
  const esaExcess = Math.max(0, excessContributions.esaExcessContribution || 0);
  const iraExciseTax = round2(iraExcess * EXCESS_CONTRIBUTION.PENALTY_RATE);
  const hsaExciseTax = round2(hsaExcess * EXCESS_CONTRIBUTION.PENALTY_RATE);
  const esaExciseTax = round2(esaExcess * EXCESS_CONTRIBUTION.PENALTY_RATE);

  // Part I: Early distribution penalty (10%)
  // Step 1: Sum taxable amounts of all early distributions (code 1)
  let totalEarlyDistributions = 0;
  let totalExceptionAmount = 0;

  for (const r of income1099R || []) {
    const code = (r.distributionCode || '7').toUpperCase();
    if (EARLY_DISTRIBUTION.PENALTY_CODES.includes(code)) {
      const taxableAmount = Math.max(0, r.taxableAmount || 0);
      totalEarlyDistributions += taxableAmount;

      // IRC §72(t)(2) partial exceptions — subtract the exception amount
      // from this distribution's contribution to the penalty base.
      // The exception amount cannot exceed the distribution's taxable amount.
      if (r.earlyDistributionExceptionAmount && r.earlyDistributionExceptionAmount > 0) {
        const exceptionForThisDist = Math.min(
          Math.max(0, r.earlyDistributionExceptionAmount),
          taxableAmount,
        );
        totalExceptionAmount += exceptionForThisDist;
      }
    }
  }

  // Step 2: Apply SECURE 2.0 emergency personal expense exemption — IRC §72(t)(2)(I)
  const emergencyAmount = Math.max(0, emergencyDistributions?.totalEmergencyDistributions || 0);
  const emergencyExemption = round2(Math.min(
    emergencyAmount,
    EMERGENCY_DISTRIBUTION.ANNUAL_LIMIT,
    Math.max(0, totalEarlyDistributions - totalExceptionAmount), // Don't exempt more than remains after exceptions
  ));

  // Step 3: Compute penalty base = early distributions − exceptions − emergency exemption
  const penaltyBaseAmount = round2(Math.max(0, totalEarlyDistributions - totalExceptionAmount - emergencyExemption));
  const earlyDistributionPenalty = round2(penaltyBaseAmount * EARLY_DISTRIBUTION.PENALTY_RATE);

  const totalPenalty = round2(iraExciseTax + hsaExciseTax + esaExciseTax + earlyDistributionPenalty);

  return {
    iraExciseTax,
    hsaExciseTax,
    esaExciseTax,
    earlyDistributionPenalty,
    emergencyExemption,
    earlyDistributionExceptionAmount: round2(totalExceptionAmount),
    totalPenalty,
  };
}
