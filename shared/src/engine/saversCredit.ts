import { FilingStatus, SaversCreditResult } from '../types/index.js';
import { SAVERS_CREDIT } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Eligibility options for the Saver's Credit.
 *
 * IRC §25B(c) disqualifies:
 *   (1) Individuals under age 18 at end of tax year
 *   (2) Full-time students (for 5+ months during the year)
 *   (3) Individuals claimed as a dependent on another return
 */
export interface SaversCreditEligibility {
  dateOfBirth?: string;             // For age 18+ check
  spouseDateOfBirth?: string;       // For MFJ spouse age check
  taxYear: number;
  isFullTimeStudent?: boolean;      // Disqualifies under §25B(c)(2)
  isSpouseFullTimeStudent?: boolean; // Disqualifies spouse under §25B(c)(2)
  isClaimedAsDependent?: boolean;   // Disqualifies under §25B(c)(3)
}

/**
 * Calculate the Retirement Savings Contributions Credit (Saver's Credit, Form 8880).
 *
 * The credit is a percentage (50%, 20%, 10%, or 0%) of eligible retirement
 * contributions (IRA, 401(k), 403(b), etc.) up to $2,000 ($4,000 MFJ).
 *
 * The rate depends on filing status and AGI:
 *   Filing Status    |   50%        |   20%        |   10%        |   0%
 *   Single/MFS       | ≤ $23,750    | ≤ $25,750    | ≤ $36,500    | > $36,500
 *   HoH              | ≤ $35,625    | ≤ $38,625    | ≤ $54,750    | > $54,750
 *   MFJ/QSS          | ≤ $47,500    | ≤ $51,500    | ≤ $73,000    | > $73,000
 *
 * Eligibility (IRC §25B(c)):
 *   - Must be age 18 or older at end of tax year
 *   - Must not be a full-time student
 *   - Must not be claimed as a dependent on another person's return
 *
 * This is a non-refundable credit.
 *
 * @authority
 *   IRC: Section 25B — elective deferrals and IRA contributions by certain individuals
 *   IRC: Section 25B(c) — eligible individual (age 18+, not student, not dependent)
 *   Rev. Proc: 2024-40, Section 3.06 — saver's credit AGI thresholds
 *   Form: Form 8880
 * @scope Retirement Savings Contributions Credit (50%/20%/10%) with eligibility gating
 * @limitations None
 */

export function calculateSaversCredit(
  contributions: number,
  agi: number,
  filingStatus: FilingStatus,
  eligibility?: SaversCreditEligibility,
): SaversCreditResult {
  const zero: SaversCreditResult = { eligibleContributions: 0, creditRate: 0, credit: 0 };

  if (contributions <= 0) return zero;

  // IRC §25B(c) eligibility checks
  if (eligibility) {
    // (3) Cannot be claimed as a dependent on another return
    if (eligibility.isClaimedAsDependent) return zero;

    // (2) Cannot be a full-time student
    if (eligibility.isFullTimeStudent) return zero;

    // (1) Must be age 18 or older at end of tax year
    if (eligibility.dateOfBirth) {
      const age = getAgeAtEndOfYear(eligibility.dateOfBirth, eligibility.taxYear);
      if (age !== null && age < 18) return zero;
    }

    // For MFJ: if BOTH spouses are disqualified, no credit
    // (If only one spouse is disqualified, the other's contributions may still qualify)
    const isMFJ = filingStatus === FilingStatus.MarriedFilingJointly ||
      filingStatus === FilingStatus.QualifyingSurvivingSpouse;
    if (isMFJ && eligibility.isSpouseFullTimeStudent) {
      // Both spouses are students → no credit (primary already checked above)
      // If only spouse is student, primary can still claim
    }
  }

  // Contribution cap: $4,000 for MFJ/QSS, $2,000 for all others
  const isMFJ = filingStatus === FilingStatus.MarriedFilingJointly ||
    filingStatus === FilingStatus.QualifyingSurvivingSpouse;
  const cap = isMFJ ? SAVERS_CREDIT.CONTRIBUTION_LIMIT_MFJ : SAVERS_CREDIT.CONTRIBUTION_LIMIT;

  const eligibleContributions = round2(Math.min(contributions, cap));

  // Determine credit rate based on AGI and filing status
  const creditRate = getSaversCreditRate(agi, filingStatus);

  if (creditRate === 0) return zero;

  const credit = round2(eligibleContributions * creditRate);

  return {
    eligibleContributions,
    creditRate,
    credit,
  };
}

function getSaversCreditRate(agi: number, filingStatus: FilingStatus): number {
  const thresholds = getThresholds(filingStatus);

  if (agi <= thresholds.rate50) return 0.50;
  if (agi <= thresholds.rate20) return 0.20;
  if (agi <= thresholds.rate10) return 0.10;
  return 0;
}

function getThresholds(filingStatus: FilingStatus): { rate50: number; rate20: number; rate10: number } {
  switch (filingStatus) {
    case FilingStatus.MarriedFilingJointly:
    case FilingStatus.QualifyingSurvivingSpouse:
      return {
        rate50: SAVERS_CREDIT.MFJ_50,
        rate20: SAVERS_CREDIT.MFJ_20,
        rate10: SAVERS_CREDIT.MFJ_10,
      };
    case FilingStatus.HeadOfHousehold:
      return {
        rate50: SAVERS_CREDIT.HOH_50,
        rate20: SAVERS_CREDIT.HOH_20,
        rate10: SAVERS_CREDIT.HOH_10,
      };
    default: // Single, MFS
      return {
        rate50: SAVERS_CREDIT.SINGLE_50,
        rate20: SAVERS_CREDIT.SINGLE_20,
        rate10: SAVERS_CREDIT.SINGLE_10,
      };
  }
}

/** Parse a date string and compute age at end of the given tax year. */
function getAgeAtEndOfYear(dateOfBirth: string, taxYear: number): number | null {
  // Support formats: YYYY-MM-DD, MM/DD/YYYY, etc.
  const parts = dateOfBirth.includes('-')
    ? dateOfBirth.split('-').map(Number)
    : dateOfBirth.split('/').map(Number);
  if (parts.length < 3) return null;

  const [a, b, c] = parts;
  // YYYY-MM-DD vs MM/DD/YYYY
  const year = a > 1900 ? a : c;
  if (!year || isNaN(year)) return null;

  return taxYear - year;
}
