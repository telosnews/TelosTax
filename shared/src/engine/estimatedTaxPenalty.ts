import { FilingStatus, EstimatedTaxPenaltyResult, AnnualizedIncomeInfo, QuarterlyPenaltyDetail } from '../types/index.js';
import { ESTIMATED_TAX_PENALTY } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate Estimated Tax Penalty (Form 2210).
 *
 * You may owe a penalty if you didn't pay enough tax through withholding
 * and estimated payments during the year.
 *
 * Safe harbors (no penalty if):
 *   1. Tax owed after withholding/payments < $1,000
 *   2. Payments ≥ 90% of current year tax
 *   3. Payments ≥ 100% of prior year tax (110% if AGI > $150k/$75k MFS)
 *
 * Penalty is computed using the per-quarter day-count method (Form 2210 Part IV):
 *   For each quarter's underpayment, penalty = underpayment × rate × days / 365
 *   where days are broken out by IRS rate period boundaries.
 *
 * When annualized income data is provided, also computes the annualized
 * income installment method (Schedule AI) and returns the lesser penalty.
 *
 * @authority
 *   IRC: Section 6654 — failure by individual to pay estimated income tax
 *   IRC: Section 6654(d)(2) — annualized income installment method
 *   IRC: Section 6621(a)(2) — underpayment rate = federal short-term rate + 3%
 *   Form: Form 2210
 *   Form: Form 2210, Schedule AI
 * @scope Estimated tax penalty with safe harbors, per-quarter day-count, and annualized income
 * @limitations
 *   Does not model mid-quarter payments (assumes equal quarterly payments)
 *   Annualized method does not model itemized deduction variations by period
 */
export function calculateEstimatedTaxPenalty(
  currentYearTax: number,
  totalPayments: number,      // Withholding + estimated payments
  priorYearTax: number | undefined,  // undefined = unknown (no prior year safe harbor)
  agi: number,
  filingStatus: FilingStatus,
  annualizedIncome?: AnnualizedIncomeInfo,
): EstimatedTaxPenaltyResult {
  const c = ESTIMATED_TAX_PENALTY;

  const zero: EstimatedTaxPenaltyResult = {
    requiredAnnualPayment: 0,
    totalPaymentsMade: round2(totalPayments),
    underpaymentAmount: 0,
    penalty: 0,
  };

  const taxOwed = round2(currentYearTax - totalPayments);

  // Safe harbor 1: Tax owed < $1,000
  if (taxOwed < c.MINIMUM_PENALTY_THRESHOLD) return zero;

  // Determine required payment (lesser of 90% current or 100%/110% prior)
  const currentYearRequired = round2(currentYearTax * c.REQUIRED_ANNUAL_PAYMENT_RATE);

  // When prior year tax is unknown (undefined), only the 90% current-year test applies.
  // When prior year tax is known and > 0, use lesser of 90% current or 100%/110% prior.
  let requiredAnnualPayment: number;
  if (priorYearTax !== undefined && priorYearTax > 0) {
    // MFS uses half the high-income threshold
    const highIncomeThreshold = filingStatus === FilingStatus.MarriedFilingSeparately
      ? c.HIGH_INCOME_THRESHOLD / 2
      : c.HIGH_INCOME_THRESHOLD;
    const priorYearRate = agi > highIncomeThreshold
      ? c.PRIOR_YEAR_SAFE_HARBOR_HIGH_INCOME
      : c.PRIOR_YEAR_SAFE_HARBOR;
    const priorYearRequired = round2(priorYearTax * priorYearRate);
    requiredAnnualPayment = Math.min(currentYearRequired, priorYearRequired);
  } else {
    // Unknown or zero prior year: use 90% of current year only
    requiredAnnualPayment = currentYearRequired;
  }

  // Safe harbor check: did payments meet the required amount?
  if (totalPayments >= requiredAnnualPayment) return { ...zero, requiredAnnualPayment };

  // Underpayment = required - paid
  const underpaymentAmount = round2(Math.max(0, requiredAnnualPayment - totalPayments));

  // ─── Per-Quarter Day-Count Penalty (Form 2210 Part IV) ──
  // Distribute payments equally across quarters (simplified — no mid-quarter tracking)
  const quarterlyPayment = round2(totalPayments / 4);
  const quarterlyRequired = round2(requiredAnnualPayment / 4);

  const regularResult = calculateDayCountPenalty(quarterlyRequired, quarterlyPayment);
  const regularPenalty = regularResult.totalPenalty;

  // ─── Annualized Income Installment Method (Schedule AI) ──
  // IRC §6654(d)(2): Taxpayers with seasonal/uneven income can compute required
  // installments based on annualized income through each quarter.
  // The taxpayer uses whichever method produces the lower penalty.
  if (annualizedIncome && annualizedIncome.cumulativeIncome) {
    const annualizedPenalty = calculateAnnualizedPenalty(
      annualizedIncome,
      currentYearTax,
      requiredAnnualPayment,
      totalPayments,
    );

    if (annualizedPenalty < regularPenalty) {
      return {
        requiredAnnualPayment,
        totalPaymentsMade: round2(totalPayments),
        underpaymentAmount,
        penalty: annualizedPenalty,
        usedAnnualizedMethod: true,
        regularPenalty,
        annualizedPenalty,
        quarterlyDetail: regularResult.quarterlyDetail,
      };
    }
  }

  return {
    requiredAnnualPayment,
    totalPaymentsMade: round2(totalPayments),
    underpaymentAmount,
    penalty: regularPenalty,
    usedAnnualizedMethod: false,
    regularPenalty,
    annualizedPenalty: undefined,
    quarterlyDetail: regularResult.quarterlyDetail,
  };
}

/**
 * Calculate penalty using per-quarter day-count method (Form 2210 Part IV).
 *
 * For each quarter:
 *   1. Compute underpayment = max(0, required installment - payment)
 *   2. For each rate period the underpayment spans:
 *      penalty += underpayment × period_rate × days_in_period / 365
 *   3. Overpayments from earlier quarters carry forward
 *
 * The day-count matrix (DAYS_MATRIX) and period rates (PERIOD_RATES) are
 * defined in tax2025.ts constants, making it easy to update for future years
 * when rates change mid-year.
 *
 * @authority IRC §6654(a), Form 2210 Part IV
 */
function calculateDayCountPenalty(
  quarterlyRequired: number,
  quarterlyPayment: number,
): { totalPenalty: number; quarterlyDetail: QuarterlyPenaltyDetail[] } {
  const c = ESTIMATED_TAX_PENALTY;
  const daysMatrix = c.DAYS_MATRIX;
  const periodRates = c.PERIOD_RATES;

  let totalPenalty = 0;
  let carryoverCredit = 0;  // Overpayment from prior quarters carries forward
  const quarterlyDetail: QuarterlyPenaltyDetail[] = [];

  for (let q = 0; q < 4; q++) {
    // Available payment = this quarter's payment + carryover from prior quarters
    const availablePayment = round2(quarterlyPayment + carryoverCredit);
    const underpayment = round2(Math.max(0, quarterlyRequired - availablePayment));

    // Carryover excess to next quarter
    carryoverCredit = round2(Math.max(0, availablePayment - quarterlyRequired));

    // Calculate penalty for this quarter's underpayment using day-count method
    let quarterPenalty = 0;
    if (underpayment > 0) {
      for (let p = 0; p < 4; p++) {
        const days = daysMatrix[q][p];
        if (days > 0) {
          // Penalty = underpayment × annual_rate × days / 365
          quarterPenalty += underpayment * periodRates[p] * days / 365;
        }
      }
      quarterPenalty = round2(quarterPenalty);
    }

    totalPenalty = round2(totalPenalty + quarterPenalty);

    quarterlyDetail.push({
      requiredInstallment: quarterlyRequired,
      paymentMade: quarterlyPayment,
      underpayment,
      penalty: quarterPenalty,
    });
  }

  return { totalPenalty, quarterlyDetail };
}

/**
 * Calculate penalty using the annualized income installment method.
 *
 * For each quarter:
 *   1. Annualize cumulative income: income × annualization factor
 *   2. Compute tax on annualized income
 *   3. Required installment = annualized tax × cumulative installment %
 *   4. Credit for prior-quarter overpayments
 *   5. Underpayment per quarter = max(0, required - paid for quarter)
 *   6. Penalty per quarter using day-count method
 *
 * Annualization factors: [4, 2.4, 1.5, 1] (3, 5, 8, 12 months)
 * Required installment %: [25%, 50%, 75%, 100%] cumulative
 *
 * @authority IRC §6654(d)(2), Form 2210 Schedule AI
 */
function calculateAnnualizedPenalty(
  annualizedIncome: AnnualizedIncomeInfo,
  currentYearTax: number,
  requiredAnnualPayment: number,
  totalPayments: number,
): number {
  const c = ESTIMATED_TAX_PENALTY;
  const factors = c.ANNUALIZATION_FACTORS;
  const installPcts = c.QUARTERLY_INSTALLMENT_PERCENTAGES;
  const daysMatrix = c.DAYS_MATRIX;
  const periodRates = c.PERIOD_RATES;

  // Distribute total payments equally across quarters (simplified)
  // unless quarterly withholding is provided
  const cw = annualizedIncome.cumulativeWithholding;
  const quarterlyPayments: number[] = cw
    ? [
        cw[0] || 0,
        (cw[1] || 0) - (cw[0] || 0),
        (cw[2] || 0) - (cw[1] || 0),
        (cw[3] || 0) - (cw[2] || 0),
      ]
    : [totalPayments / 4, totalPayments / 4, totalPayments / 4, totalPayments / 4];

  let totalPenalty = 0;
  let carryoverCredit = 0; // Overpayment from prior quarters carries forward

  for (let q = 0; q < 4; q++) {
    const cumulativeIncome = annualizedIncome.cumulativeIncome[q] || 0;

    // Step 1: Annualize the cumulative income
    const annualizedAmt = round2(cumulativeIncome * factors[q]);

    // Step 2: Compute tax on annualized income (proportional to current year)
    // Simplified: use ratio of annualized to actual income × actual tax
    const fullYearIncome = annualizedIncome.cumulativeIncome[3] || 0;
    const annualizedTax = fullYearIncome > 0
      ? round2(currentYearTax * (annualizedAmt / fullYearIncome))
      : 0;

    // Step 3: Required installment for this quarter
    // = annualized tax × cumulative installment % minus prior quarters' required amounts
    const cumulativeRequired = round2(annualizedTax * installPcts[q]);
    const priorCumulativeRequired = q > 0
      ? round2(annualizedTax * installPcts[q - 1])
      : 0;
    // But cap at the regular required installment for this quarter
    const regularQuarterlyRequired = round2(requiredAnnualPayment * 0.25);

    // The required installment is the lesser of annualized or regular method
    const annualizedQuarterlyRequired = round2(Math.max(0, cumulativeRequired - priorCumulativeRequired));
    const quarterRequired = Math.min(annualizedQuarterlyRequired, regularQuarterlyRequired);

    // Step 4: Apply payment and carryover
    const availablePayment = round2(quarterlyPayments[q] + carryoverCredit);
    const underpayment = round2(Math.max(0, quarterRequired - availablePayment));

    // Carryover excess payment to next quarter
    carryoverCredit = round2(Math.max(0, availablePayment - quarterRequired));

    // Step 5: Per-quarter penalty using day-count method
    if (underpayment > 0) {
      let quarterPenalty = 0;
      for (let p = 0; p < 4; p++) {
        const days = daysMatrix[q][p];
        if (days > 0) {
          quarterPenalty += underpayment * periodRates[p] * days / 365;
        }
      }
      totalPenalty = round2(totalPenalty + round2(quarterPenalty));
    }
  }

  return round2(totalPenalty);
}
