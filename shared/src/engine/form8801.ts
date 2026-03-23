import { Form8801Info, Form8801Result } from '../types/index.js';
import { round2 } from './utils.js';

/**
 * Calculate the Prior Year Minimum Tax Credit (Form 8801).
 *
 * This credit allows taxpayers who paid AMT in prior years due to "deferral items"
 * (timing differences like ISO exercises, depreciation) to recover that AMT as a
 * credit against regular tax in subsequent years.
 *
 * The credit is non-refundable and limited to the excess of regular tax over
 * current-year AMT (tentative minimum tax minus regular tax).
 *
 * @authority
 *   IRC: Section 53 — Credit for prior year minimum tax liability
 *   Form: Form 8801, Schedule 3 Line 6b
 * @scope Form 8801 simplified — user enters net prior year minimum tax and carryforward
 * @limitations Full Form 8801 recalculation of exclusion/deferral split not implemented;
 *   user must provide the net deferral amount from their prior year return or tax software
 */
export function calculateForm8801Credit(
  info: Form8801Info,
  regularTaxBeforeCredits: number,
  currentYearAMT: number,
): Form8801Result {
  const zero: Form8801Result = {
    totalCreditAvailable: 0,
    creditLimitation: 0,
    credit: 0,
    carryforwardToNextYear: 0,
  };

  if (!info) return zero;

  const netPriorYear = Math.max(0, info.netPriorYearMinimumTax || 0);
  const carryforward = Math.max(0, info.priorYearCreditCarryforward || 0);

  // Form 8801 Line 21: Total credit available
  const totalCreditAvailable = round2(netPriorYear + carryforward);

  if (totalCreditAvailable <= 0) return zero;

  // Form 8801 Line 24: Credit limitation
  // Credit can only offset regular tax in excess of current-year AMT
  const creditLimitation = round2(Math.max(0, regularTaxBeforeCredits - currentYearAMT));

  // Form 8801 Line 25: Credit claimed
  const credit = round2(Math.min(totalCreditAvailable, creditLimitation));

  // Form 8801 Line 26: Carryforward to next year
  const carryforwardToNextYear = round2(totalCreditAvailable - credit);

  return {
    totalCreditAvailable,
    creditLimitation,
    credit,
    carryforwardToNextYear,
  };
}
