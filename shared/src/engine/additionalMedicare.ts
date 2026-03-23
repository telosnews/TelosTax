import { FilingStatus } from '../types/index.js';
import { SE_TAX } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate Additional Medicare Tax on W-2 wages (Form 8959).
 *
 * 0.9% Additional Medicare Tax applies on wages above the threshold:
 *   - $200,000 for Single/HoH/QSS
 *   - $250,000 for MFJ
 *   - $125,000 for MFS
 *
 * When a filer has BOTH W-2 wages and SE income, the threshold is shared.
 * This function computes the Additional Medicare on W-2 wages only.
 * The SE portion is already handled by scheduleSE.ts.
 *
 * To avoid double-counting, we compute the combined amount and subtract
 * what was already computed in Schedule SE.
 *
 * @authority
 *   IRC: Section 3101(b)(2) — additional hospital insurance tax on employees
 *   ACA: Section 9015 — additional Medicare tax
 *   Form: Form 8959
 * @scope 0.9% Additional Medicare Tax on W-2 wages
 * @limitations None
 */
export function calculateAdditionalMedicareTaxW2(
  w2MedicareWages: number,
  seNetEarnings: number,
  filingStatus: FilingStatus,
): number {
  if (w2MedicareWages <= 0) return 0;

  const threshold = getThreshold(filingStatus);

  // Combined wages + SE for threshold purposes
  const combinedEarnings = w2MedicareWages + Math.max(0, seNetEarnings);

  // Total Additional Medicare on combined earnings
  const totalAdditionalMedicare = Math.max(0, combinedEarnings - threshold) * SE_TAX.ADDITIONAL_MEDICARE_RATE;

  // Additional Medicare already computed on SE earnings in scheduleSE.ts
  const seAdditionalMedicare = Math.max(0, seNetEarnings - threshold) * SE_TAX.ADDITIONAL_MEDICARE_RATE;

  // W-2 portion is the total minus what was already computed on SE
  // But it can't be negative (if SE alone exceeds threshold, W-2 portion is
  // the additional amount from adding W-2 wages on top)
  const w2AdditionalMedicare = Math.max(0, round2(totalAdditionalMedicare - seAdditionalMedicare));

  return w2AdditionalMedicare;
}

function getThreshold(filingStatus: FilingStatus): number {
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
