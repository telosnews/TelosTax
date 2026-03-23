import { FarmRentalInfo, FarmRentalResult } from '../types/index.js';
import { round2 } from './utils.js';

/**
 * Calculate Form 4835 — Farm Rental Income and Expenses.
 *
 * For landowners who receive farm rental income but do not materially
 * participate in farming operations. Income is passive by definition.
 * Net income/loss flows to Schedule E, Part I.
 *
 * @authority
 *   IRC: Section 469 — Passive activity rules
 *   Form: Form 4835
 * @scope Passive farm rental income/loss computation
 * @limitations No depreciation calculation (user enters amount); no Form 8582 integration (passive loss handled upstream)
 */
export function calculateForm4835(info: FarmRentalInfo): FarmRentalResult {
  const grossIncome = round2(Math.max(0, info.rentalIncome));
  const exp = info.expenses || {};
  const totalExpenses = round2(
    (exp.insurance || 0) + (exp.repairs || 0) + (exp.taxes || 0) +
    (exp.utilities || 0) + (exp.depreciation || 0) + (exp.other || 0),
  );
  const netIncome = round2(grossIncome - totalExpenses);

  return { grossIncome, totalExpenses, netIncome };
}
