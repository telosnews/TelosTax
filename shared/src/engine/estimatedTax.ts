import { ESTIMATED_TAX } from '../constants/tax2025.js';
import { round2 } from './utils.js';
import { FilingStatus } from '../types/index.js';

/**
 * Calculate estimated quarterly tax payments.
 * totalTaxLiability = total tax owed minus withholding.
 * Each quarter = totalTaxLiability / 4.
 *
 * @authority
 *   IRC: Section 6654 — failure by individual to pay estimated income tax
 *   Form: Form 1040-ES
 * @scope Quarterly estimated tax calculation
 * @limitations None
 */
export function calculateEstimatedQuarterly(
  totalTaxOwed: number,
  totalWithholding: number,
): { quarterlyPayment: number; annualEstimated: number } {
  const annualEstimated = Math.max(0, round2(totalTaxOwed - totalWithholding));
  const quarterlyPayment = round2(annualEstimated / ESTIMATED_TAX.QUARTERLY_DIVISOR);

  return { quarterlyPayment, annualEstimated };
}

/**
 * Calculate safe harbor amount (to avoid underpayment penalty).
 * 100% of current year tax, or 110% if AGI > $150k ($75k for MFS).
 *
 * @authority
 *   IRC: Section 6654 — failure by individual to pay estimated income tax
 *   IRC: Section 6654(d)(1)(C)(i) — high-income threshold halved for MFS
 *   Form: Form 1040-ES
 * @scope Safe harbor calculation to avoid underpayment penalty
 * @limitations None
 */
export function calculateSafeHarbor(
  currentYearTax: number,
  agi: number,
  filingStatus?: FilingStatus,
): number {
  const threshold = filingStatus === FilingStatus.MarriedFilingSeparately
    ? ESTIMATED_TAX.HIGH_INCOME_THRESHOLD / 2
    : ESTIMATED_TAX.HIGH_INCOME_THRESHOLD;
  const rate = agi > threshold
    ? ESTIMATED_TAX.HIGH_INCOME_SAFE_HARBOR
    : ESTIMATED_TAX.SAFE_HARBOR_RATE;

  return round2(currentYearTax * rate);
}
