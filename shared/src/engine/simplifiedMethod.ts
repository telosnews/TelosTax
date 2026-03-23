/**
 * Simplified Method Worksheet — Taxable Portion of Pension/Annuity
 *
 * Used when a 1099-R has a gross distribution but the taxable amount is
 * not determined by the payer (Box 2a is blank or "unknown"). The IRS
 * Simplified Method (Pub 939 / Form 1040 instructions) computes the
 * tax-free portion based on after-tax contributions and expected payments.
 *
 * @authority
 *   IRC §72 — Annuities; certain proceeds of endowment and life insurance
 *   IRS Pub 939 — General Rule for Pensions and Annuities
 *   Form 1040 Instructions — Simplified Method Worksheet
 * @scope Single-life and joint-and-survivor annuities with annuity start dates after Nov 18, 1996
 * @limitations Does not handle pre-Nov 1996 annuity start dates (which use the General Rule per Pub 939)
 */

import { round2 } from './utils.js';

/**
 * IRS Simplified Method table of expected number of payments
 * Based on beneficiary's age at annuity starting date.
 *
 * Table 1: Single Life — IRC §72(d)(1)(B)(iii)
 */
const SINGLE_LIFE_TABLE: Array<{ maxAge: number; payments: number }> = [
  { maxAge: 55, payments: 360 },
  { maxAge: 60, payments: 310 },
  { maxAge: 65, payments: 260 },
  { maxAge: 70, payments: 210 },
  { maxAge: Infinity, payments: 160 }, // 71 and over
];

/**
 * Table 2: Joint and Survivor — IRC §72(d)(1)(B)(iv)
 * Based on combined ages of annuitant and beneficiary.
 */
const JOINT_SURVIVOR_TABLE: Array<{ maxCombinedAge: number; payments: number }> = [
  { maxCombinedAge: 110, payments: 410 },
  { maxCombinedAge: 120, payments: 360 },
  { maxCombinedAge: 130, payments: 310 },
  { maxCombinedAge: 140, payments: 260 },
  { maxCombinedAge: Infinity, payments: 210 }, // 141 and over
];

export interface SimplifiedMethodInput {
  /** Gross monthly pension/annuity payment (Box 1 ÷ number of payments in year) */
  monthlyPayment: number;
  /** Total after-tax (non-deductible) contributions to the plan — employer plan records */
  totalContributions: number;
  /** Age of the primary annuitant at annuity start date */
  ageAtStartDate: number;
  /** Is this a joint-and-survivor annuity? */
  isJointAndSurvivor: boolean;
  /** For joint-and-survivor: combined ages of annuitant and beneficiary at start date */
  combinedAge?: number;
  /** Number of payments received this tax year (typically 12 for full year) */
  paymentsThisYear: number;
  /** Total tax-free amount already recovered in prior years (from prior worksheets) */
  priorYearTaxFreeRecovery?: number;
}

export interface SimplifiedMethodResult {
  /** Expected number of payments from IRS table */
  expectedPayments: number;
  /** Tax-free portion of each payment */
  taxFreePerPayment: number;
  /** Total tax-free amount for this year */
  taxFreeThisYear: number;
  /** Taxable amount for this year (= gross payments − tax-free amount) */
  taxableAmount: number;
  /** Remaining cost basis to recover in future years */
  remainingBasis: number;
  /** Total gross payments received this year */
  grossPaymentsThisYear: number;
}

/**
 * Calculate the taxable portion of a pension/annuity using the IRS Simplified Method.
 *
 * Worksheet Steps (per Form 1040 instructions):
 * 1. Enter total pension received this year (monthly × paymentsThisYear)
 * 2. Enter cost (total after-tax contributions)
 * 3. Look up expected number of payments from IRS table
 * 4. Tax-free per payment = cost ÷ expected payments
 * 5. Tax-free this year = tax-free per payment × paymentsThisYear
 * 6. Taxable = gross − tax-free
 *
 * Once the full cost has been recovered, all subsequent payments are fully taxable.
 */
export function calculateSimplifiedMethod(input: SimplifiedMethodInput): SimplifiedMethodResult {
  const grossPaymentsThisYear = round2(input.monthlyPayment * input.paymentsThisYear);

  // Look up expected number of payments from appropriate IRS table
  let expectedPayments: number;
  if (input.isJointAndSurvivor && input.combinedAge !== undefined) {
    const entry = JOINT_SURVIVOR_TABLE.find(e => input.combinedAge! <= e.maxCombinedAge);
    expectedPayments = entry?.payments ?? 210; // Default: 141+
  } else {
    const entry = SINGLE_LIFE_TABLE.find(e => input.ageAtStartDate <= e.maxAge);
    expectedPayments = entry?.payments ?? 160; // Default: 71+
  }

  // Tax-free portion per payment = total contributions ÷ expected payments
  const taxFreePerPayment = expectedPayments > 0
    ? round2(input.totalContributions / expectedPayments)
    : 0;

  // Check if full cost has already been recovered in prior years
  const priorRecovery = Math.max(0, input.priorYearTaxFreeRecovery || 0);
  const remainingBasisBefore = round2(Math.max(0, input.totalContributions - priorRecovery));

  // Tax-free this year = min(taxFreePerPayment × paymentsThisYear, remaining basis)
  // Cannot recover more than the remaining cost basis
  const rawTaxFreeThisYear = round2(taxFreePerPayment * input.paymentsThisYear);
  const taxFreeThisYear = round2(Math.min(rawTaxFreeThisYear, remainingBasisBefore));

  // Taxable amount = gross - tax-free
  const taxableAmount = round2(Math.max(0, grossPaymentsThisYear - taxFreeThisYear));

  // Remaining basis after this year's recovery
  const remainingBasis = round2(Math.max(0, remainingBasisBefore - taxFreeThisYear));

  return {
    expectedPayments,
    taxFreePerPayment,
    taxFreeThisYear,
    taxableAmount,
    remainingBasis,
    grossPaymentsThisYear,
  };
}
