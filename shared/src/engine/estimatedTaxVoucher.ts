/**
 * Estimated Tax Voucher Assessment (Form 1040-ES)
 *
 * Analyzes a completed tax return to determine whether the filer should make
 * quarterly estimated tax payments for the next tax year, and computes the
 * recommended quarterly amount using the safe harbor method.
 *
 * @authority
 *   IRC §6654 — Failure by individual to pay estimated income tax
 *   IRC §6654(d)(1)(B)(i) — 100% of current year tax safe harbor
 *   IRC §6654(d)(1)(C)(i) — 110% if AGI > $150k ($75k MFS)
 *   IRC §6654(e)(1) — $1,000 minimum threshold
 *   Form 1040-ES — Estimated Tax for Individuals
 */
import type { TaxReturn, CalculationResult } from '../types/index.js';
import { FilingStatus } from '../types/index.js';
import { ESTIMATED_TAX } from '../constants/tax2025.js';
import { calculateSafeHarbor } from './estimatedTax.js';
import { round2 } from './utils.js';

/** Quarterly due dates for 2026 estimated tax payments. */
export const ESTIMATED_TAX_2026_DUE_DATES = [
  { quarter: 1, label: 'Q1 2026', date: 'April 15, 2026' },
  { quarter: 2, label: 'Q2 2026', date: 'June 15, 2026' },
  { quarter: 3, label: 'Q3 2026', date: 'September 15, 2026' },
  { quarter: 4, label: 'Q4 2026', date: 'January 15, 2027' },
] as const;

export interface EstimatedPaymentRecommendation {
  /** Whether estimated payments are recommended */
  recommended: boolean;
  /** Human-readable reasons for the recommendation */
  reasons: string[];
  /** Recommended payment per quarter */
  quarterlyAmount: number;
  /** Total annual recommended payment */
  annualAmount: number;
  /** Safe harbor amount based on current year tax */
  safeHarborAmount: number;
  /** Whether filer crosses the high-income threshold */
  isHighIncome: boolean;
  /** Current year total tax (Form 1040) */
  currentYearTax: number;
  /** Projected withholding (assumes same W-2 jobs next year) */
  projectedWithholding: number;
  /** Whether the filer has self-employment income */
  hasSelfEmploymentIncome: boolean;
  /** Method used to compute the recommendation */
  calculationBasis: 'safe_harbor_current_year';
  /** Explanatory note for the user */
  note: string;
  /** Quarterly due dates */
  dueDates: typeof ESTIMATED_TAX_2026_DUE_DATES;
}

/**
 * Assess whether the filer should make estimated tax payments for 2026
 * based on their completed 2025 return.
 */
export function assessEstimatedPaymentNeed(
  taxReturn: TaxReturn,
  calc: CalculationResult,
): EstimatedPaymentRecommendation {
  const filingStatus = taxReturn.filingStatus ?? FilingStatus.Single;
  const totalTax = calc.form1040.totalTax;
  const agi = calc.form1040.agi;
  const totalWithholding = calc.form1040.totalWithholding;
  const gap = round2(totalTax - totalWithholding);
  const hasSelfEmploymentIncome = (calc.scheduleSE?.totalSETax ?? 0) > 0;

  // High-income threshold: $150k, halved for MFS per IRC §6654(d)(1)(C)(i)
  const threshold = filingStatus === FilingStatus.MarriedFilingSeparately
    ? ESTIMATED_TAX.HIGH_INCOME_THRESHOLD / 2
    : ESTIMATED_TAX.HIGH_INCOME_THRESHOLD;
  const isHighIncome = agi > threshold;

  // Safe harbor: 100% of current year tax, or 110% if high income
  const safeHarborAmount = calculateSafeHarbor(totalTax, agi, filingStatus);

  // Recommended annual amount = safe harbor minus projected withholding (assume same)
  const annualAmount = round2(Math.max(0, safeHarborAmount - totalWithholding));
  const quarterlyAmount = round2(annualAmount / ESTIMATED_TAX.QUARTERLY_DIVISOR);

  // Recommend if gap >= $1,000 (IRC §6654(e)(1) threshold)
  const recommended = gap >= 1000;

  // Build reasons
  const reasons: string[] = [];
  if (hasSelfEmploymentIncome) {
    reasons.push('You have self-employment income, which has no automatic withholding.');
  }
  if (gap >= 1000) {
    reasons.push(
      `Your 2025 tax exceeded withholding by $${gap.toLocaleString()}, above the $1,000 threshold.`,
    );
  }
  if (isHighIncome) {
    reasons.push(
      `Your AGI exceeds $${threshold.toLocaleString()}, so the safe harbor requires 110% of current year tax.`,
    );
  }

  const note =
    'Based on your 2025 tax liability and current withholding. Adjust if your 2026 income or withholding will differ significantly.';

  return {
    recommended,
    reasons,
    quarterlyAmount,
    annualAmount,
    safeHarborAmount,
    isHighIncome,
    currentYearTax: totalTax,
    projectedWithholding: totalWithholding,
    hasSelfEmploymentIncome,
    calculationBasis: 'safe_harbor_current_year',
    note,
    dueDates: ESTIMATED_TAX_2026_DUE_DATES,
  };
}
