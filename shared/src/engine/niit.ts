import { FilingStatus } from '../types/index.js';
import { NIIT } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate Net Investment Income Tax (NIIT) — 3.8% surtax.
 *
 * NIIT applies to the lesser of:
 *   (a) net investment income, or
 *   (b) the amount by which AGI exceeds the threshold
 *
 * Investment income includes: interest, dividends, capital gains,
 * rental income, royalties, passive income (but NOT wages or SE income).
 *
 * @authority
 *   IRC: Section 1411 — imposition of tax on net investment income
 *   Form: Form 8960
 * @scope 3.8% Net Investment Income Tax
 * @limitations None
 */
export function calculateNIIT(
  agi: number,
  investmentIncome: number,
  filingStatus: FilingStatus,
): number {
  if (investmentIncome <= 0 || agi <= 0) return 0;

  const threshold = getNIITThreshold(filingStatus);
  const agiExcess = agi - threshold;

  if (agiExcess <= 0) return 0;

  const taxableAmount = Math.min(investmentIncome, agiExcess);
  return round2(taxableAmount * NIIT.RATE);
}

function getNIITThreshold(filingStatus: FilingStatus): number {
  switch (filingStatus) {
    case FilingStatus.MarriedFilingJointly:
      return NIIT.THRESHOLD_MFJ;
    case FilingStatus.MarriedFilingSeparately:
      return NIIT.THRESHOLD_MFS;
    case FilingStatus.QualifyingSurvivingSpouse:
      return NIIT.THRESHOLD_QSS;
    case FilingStatus.HeadOfHousehold:
      return NIIT.THRESHOLD_HOH;
    default:
      return NIIT.THRESHOLD_SINGLE;
  }
}
