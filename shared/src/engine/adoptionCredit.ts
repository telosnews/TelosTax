import { AdoptionCreditInfo, AdoptionCreditResult } from '../types/index.js';
import { ADOPTION_CREDIT } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate Adoption Credit (Form 8839).
 *
 * For 2025: up to $17,280 per eligible child for qualified adoption expenses.
 * Special needs adoptions get the full credit regardless of actual expenses.
 *
 * AGI phase-out: begins at $259,190, eliminated over $40,000 range.
 *
 * The credit is non-refundable but can be carried forward for up to 5 years.
 *
 * @authority
 *   IRC: Section 23 — adoption expenses
 *   Rev. Proc: 2024-40, Section 3.35 — adoption credit amounts and phase-outs
 *   Form: Form 8839
 * @scope Adoption credit with AGI phase-out ($17,280 max)
 * @limitations No multi-year carryforward tracking
 */
export function calculateAdoptionCredit(
  info: AdoptionCreditInfo,
  agi: number,
): AdoptionCreditResult {
  const zero: AdoptionCreditResult = { expensesBasis: 0, credit: 0 };

  if (!info) return zero;

  const c = ADOPTION_CREDIT;
  const numChildren = Math.max(1, info.numberOfChildren || 1);

  // Expenses basis: actual expenses or max per child for special needs
  let expensesBasis: number;
  if (info.isSpecialNeeds) {
    expensesBasis = round2(c.MAX_CREDIT * numChildren);
  } else {
    expensesBasis = round2(Math.min(info.qualifiedExpenses || 0, c.MAX_CREDIT * numChildren));
  }

  if (expensesBasis <= 0) return zero;

  // AGI phase-out
  if (agi >= c.PHASE_OUT_START + c.PHASE_OUT_RANGE) {
    return { expensesBasis, credit: 0 };
  }

  let credit = expensesBasis;
  if (agi > c.PHASE_OUT_START) {
    const phaseOutFraction = (agi - c.PHASE_OUT_START) / c.PHASE_OUT_RANGE;
    credit = round2(expensesBasis * (1 - phaseOutFraction));
  }

  return {
    expensesBasis,
    credit: round2(Math.max(0, credit)),
  };
}
