/**
 * HSA Distributions (1099-SA) — Health Savings Account Distributions
 *
 * Form 1099-SA reports distributions from an HSA (Health Savings Account).
 *
 * Tax treatment:
 * - Distribution Code 1: Normal distribution — taxable if NOT used for qualified medical expenses
 * - Distribution Code 2: Excess contributions removed — taxable
 * - Distribution Code 3: Disability — not taxable, no penalty
 * - Distribution Code 4: Death (non-spouse beneficiary) — taxable
 * - Distribution Code 5: Prohibited transaction — taxable + 20% penalty
 *
 * Penalty:
 * - 20% additional tax on taxable HSA distributions (not 10%)
 * - Penalty does NOT apply if: age 65+, disabled (code 3), or death distribution to spouse
 *
 * Qualified medical expenses: If the distribution was used entirely for qualified medical
 * expenses, the entire amount is tax-free. The user must confirm this.
 */

import { Income1099SA } from '../types/index.js';
import { HSA_DISTRIBUTIONS } from '../constants/tax2025.js';
import { round2 } from './utils.js';

export interface HSADistributionResult {
  grossDistribution: number;          // Total amount distributed
  taxableAmount: number;              // Amount subject to income tax
  penaltyAmount: number;              // 20% additional tax on taxable amount
  isQualifiedMedical: boolean;        // Whether used for qualified medical expenses
  distributionCode: string;           // Distribution code from 1099-SA
}

/**
 * Calculate the tax consequences of a single HSA distribution.
 *
 * @authority
 *   IRC: Section 223(f)(2) — tax treatment of HSA distributions
 *   IRC: Section 223(f)(4) — additional tax on distributions not used for qualified medical expenses
 *   Form: Form 1099-SA; Form 8889, Part II
 * @scope HSA distribution tax consequences (taxable + 20% penalty)
 * @limitations None
 */
export function calculateHSADistribution(dist: Income1099SA): HSADistributionResult {
  const grossDistribution = dist.grossDistribution || 0;
  const code = (dist.distributionCode || '1').trim();
  const isQualifiedMedical = !!dist.qualifiedMedicalExpenses;

  // Code 3 (disability) — always tax-free, no penalty
  if (code === '3') {
    return {
      grossDistribution,
      taxableAmount: 0,
      penaltyAmount: 0,
      isQualifiedMedical: true,
      distributionCode: code,
    };
  }

  // If used for qualified medical expenses — tax-free, no penalty
  if (isQualifiedMedical) {
    return {
      grossDistribution,
      taxableAmount: 0,
      penaltyAmount: 0,
      isQualifiedMedical: true,
      distributionCode: code,
    };
  }

  // Not qualified — taxable amount
  const taxableAmount = grossDistribution;

  // Penalty: 20% on taxable distributions
  // No penalty if age 65+ or disabled (code 3 handled above)
  // We check isAge65OrOlder separately in form1040.ts (or the caller provides it)
  // Code 4 (death) — no penalty per IRC §223(f)(4)(C)
  // Code 5 (prohibited transaction) always gets penalty
  let penaltyAmount = 0;
  const penaltyApplies = code === '5' || code === '1' || code === '2';
  if (penaltyApplies && taxableAmount > 0) {
    penaltyAmount = round2(taxableAmount * HSA_DISTRIBUTIONS.PENALTY_RATE);
  }

  return {
    grossDistribution,
    taxableAmount,
    penaltyAmount,
    isQualifiedMedical: false,
    distributionCode: code,
  };
}

/**
 * Aggregate multiple HSA distributions.
 *
 * @authority
 *   IRC: Section 223(f)(2) — tax treatment of HSA distributions
 *   IRC: Section 223(f)(4) — additional tax on distributions not used for qualified medical expenses
 *   Form: Form 1099-SA; Form 8889, Part II
 * @scope HSA distribution tax consequences (taxable + 20% penalty)
 * @limitations None
 */
export function aggregateHSADistributions(
  distributions: Income1099SA[],
  isAge65OrOlder: boolean = false,
): { totalTaxable: number; totalPenalty: number; results: HSADistributionResult[] } {
  if (!distributions || distributions.length === 0) {
    return { totalTaxable: 0, totalPenalty: 0, results: [] };
  }

  const results = distributions.map(calculateHSADistribution);

  const totalTaxable = round2(results.reduce((sum, r) => sum + r.taxableAmount, 0));

  // If age 65+, NO penalty on any distribution (still taxable, just no extra 20%)
  let totalPenalty = 0;
  if (!isAge65OrOlder) {
    totalPenalty = round2(results.reduce((sum, r) => sum + r.penaltyAmount, 0));
  }

  return { totalTaxable, totalPenalty, results };
}
