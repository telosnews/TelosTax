import { FilingStatus, ScheduleSEResult } from '../types/index.js';
import { SE_TAX } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate Schedule SE (Self-Employment Tax).
 * SE tax = 15.3% of 92.35% of net SE earnings (up to SS wage base for SS portion).
 * Additional 0.9% Medicare tax on SE earnings above threshold.
 *
 * @authority
 *   IRC: Section 1401(a)-(b) — rates of self-employment tax
 *   IRC: Section 1402(a) — definition of net earnings from self-employment
 *   Rev. Proc: 2024-40, Section 3 — Social Security wage base
 *   Form: Schedule SE (Form 1040), Lines 4a-12
 *   Pub: Publication 334, Chapter 4
 * @scope Full SE tax computation including Additional Medicare
 * @limitations None
 */
export function calculateScheduleSE(
  scheduleCNetProfit: number,
  filingStatus: FilingStatus,
  w2SocialSecurityWages: number = 0,
  optionalMethodEarnings: number = 0,
): ScheduleSEResult {
  // Per IRS Schedule SE instructions: SE tax is owed only if net SE earnings are $400+.
  // IRC §1402(b): "net earnings from self-employment" must be at least $400.
  // When optional method is used, the optional amount counts toward the $400 threshold.
  const effectiveProfit = optionalMethodEarnings > 0
    ? Math.max(scheduleCNetProfit, optionalMethodEarnings)
    : scheduleCNetProfit;
  if (effectiveProfit < SE_TAX.MINIMUM_EARNINGS_THRESHOLD) {
    return {
      netEarnings: 0,
      socialSecurityTax: 0,
      medicareTax: 0,
      additionalMedicareTax: 0,
      totalSETax: 0,
      deductibleHalf: 0,
    };
  }

  // Net SE earnings computation:
  // Line 4a: 92.35% of (total profit - optional method amounts), if positive
  // Line 4b: optional method earnings (no 92.35% reduction)
  // Line 4c: 4a + 4b
  // Per IRS Schedule SE instructions: when using optional methods, subtract
  // the optional amount from line 3 before applying 92.35%.
  let netEarnings: number;
  if (optionalMethodEarnings > 0) {
    const regularPortion = Math.max(0, scheduleCNetProfit - optionalMethodEarnings);
    const line4a = round2(regularPortion * SE_TAX.NET_EARNINGS_FACTOR);
    netEarnings = round2(line4a + optionalMethodEarnings);
  } else {
    netEarnings = round2(scheduleCNetProfit * SE_TAX.NET_EARNINGS_FACTOR);
  }

  // Social Security tax: 12.4% up to wage base (reduced by W-2 SS wages)
  const remainingSSBase = Math.max(0, SE_TAX.SS_WAGE_BASE - w2SocialSecurityWages);
  const ssTaxableEarnings = Math.min(netEarnings, remainingSSBase);
  const socialSecurityTax = round2(ssTaxableEarnings * SE_TAX.SS_RATE);

  // Medicare tax: 2.9% on all net earnings (no cap)
  const medicareTax = round2(netEarnings * SE_TAX.MEDICARE_RATE);

  // Additional Medicare tax: 0.9% on earnings above threshold
  const threshold = getAdditionalMedicareThreshold(filingStatus);
  const additionalMedicareEarnings = Math.max(0, netEarnings - threshold);
  const additionalMedicareTax = round2(additionalMedicareEarnings * SE_TAX.ADDITIONAL_MEDICARE_RATE);

  const totalSETax = round2(socialSecurityTax + medicareTax + additionalMedicareTax);

  // Deductible half of SE tax (the employer-equivalent portion).
  // IRS only allows deducting half of regular SE tax (SS + Medicare).
  // The additional 0.9% Medicare tax is NOT deductible.
  const deductibleHalf = round2((socialSecurityTax + medicareTax) / 2);

  return {
    netEarnings,
    socialSecurityTax,
    medicareTax,
    additionalMedicareTax,
    totalSETax,
    deductibleHalf,
  };
}

function getAdditionalMedicareThreshold(filingStatus: FilingStatus): number {
  switch (filingStatus) {
    case FilingStatus.MarriedFilingJointly:
      return SE_TAX.ADDITIONAL_MEDICARE_THRESHOLD_MFJ;
    case FilingStatus.MarriedFilingSeparately:
      return SE_TAX.ADDITIONAL_MEDICARE_THRESHOLD_MFS;
    default:
      // QSS, Single, HoH all use $200,000 per IRS Form 8959
      return SE_TAX.ADDITIONAL_MEDICARE_THRESHOLD_SINGLE;
  }
}
