import { FilingStatus } from '../types/index.js';
import { round2, parseDateString } from './utils.js';

// ─── 2025 EITC Constants ────────────────────────────────────────────────────
// Parameters for tax year 2025 per Rev. Proc. 2024-40, Sections 3.04-3.07.
// Exported for use by scripts/gen-constants-doc.ts (auto-generated docs).

/** Maximum investment income a taxpayer may have and still claim EITC. */
export const INVESTMENT_INCOME_LIMIT = 11_950;

/**
 * EITC schedule indexed by number of qualifying children (0–3).
 * Children counts above 3 use the "3" row.
 *
 * phaseInRate   = maxCredit / earnedIncomeThreshold
 * phaseOutRate  = maxCredit / (completePhaseOut − phaseOutStart)
 */
interface EITCBracket {
  maxCredit: number;
  earnedIncomeThreshold: number;
  phaseInRate: number;
  phaseOutStartSingle: number;
  phaseOutStartMFJ: number;
  completePhaseOutSingle: number;
  completePhaseOutMFJ: number;
  phaseOutRate: number;
}

function buildBracket(
  maxCredit: number,
  earnedIncomeThreshold: number,
  phaseOutStartSingle: number,
  phaseOutStartMFJ: number,
  completePhaseOutSingle: number,
  completePhaseOutMFJ: number,
): EITCBracket {
  const phaseInRate = maxCredit / earnedIncomeThreshold;
  // Phase-out rate is the same for single and MFJ because the phase-out
  // range (complete − start) differs by the same MFJ bump for both.
  const phaseOutRate = maxCredit / (completePhaseOutSingle - phaseOutStartSingle);
  return {
    maxCredit,
    earnedIncomeThreshold,
    phaseInRate,
    phaseOutStartSingle,
    phaseOutStartMFJ,
    completePhaseOutSingle,
    completePhaseOutMFJ,
    phaseOutRate,
  };
}

export const EITC_BRACKETS: Record<number, EITCBracket> = {
  0: buildBracket(649, 8_490, 10_620, 17_730, 19_104, 26_214),
  1: buildBracket(4_328, 12_730, 23_350, 30_470, 50_434, 57_554),
  2: buildBracket(7_152, 17_880, 23_350, 30_470, 57_310, 64_430),
  3: buildBracket(8_046, 17_880, 23_350, 30_470, 61_555, 68_675),
};

// ─── Credit Calculation for a Single Income Measure ─────────────────────────

/**
 * Compute the EITC amount for a given income value against the bracket.
 *
 * Three regions:
 *   Phase-in:  0 → earnedIncomeThreshold   →  credit grows at phaseInRate
 *   Plateau:   earnedIncomeThreshold → phaseOutStart  →  credit = maxCredit
 *   Phase-out: phaseOutStart → completePhaseOut  →  credit shrinks at phaseOutRate
 */
function creditForIncome(income: number, bracket: EITCBracket, isMFJ: boolean): number {
  if (income <= 0) return 0;

  const phaseOutStart = isMFJ ? bracket.phaseOutStartMFJ : bracket.phaseOutStartSingle;
  const completePhaseOut = isMFJ ? bracket.completePhaseOutMFJ : bracket.completePhaseOutSingle;

  // Phase-in region
  if (income <= bracket.earnedIncomeThreshold) {
    return round2(income * bracket.phaseInRate);
  }

  // Plateau region
  if (income <= phaseOutStart) {
    return bracket.maxCredit;
  }

  // Phase-out region
  if (income >= completePhaseOut) {
    return 0;
  }

  const reduction = (income - phaseOutStart) * bracket.phaseOutRate;
  return round2(Math.max(0, bracket.maxCredit - reduction));
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** EITC age limits for childless filers. */
export const EITC_MIN_AGE_NO_CHILDREN = 25;
export const EITC_MAX_AGE_NO_CHILDREN = 64; // Must be under 65 at end of tax year

/**
 * Calculate the Earned Income Tax Credit for tax year 2025.
 *
 * @authority
 *   IRC: Section 32 — earned income tax credit
 *   Rev. Proc: 2024-40, Sections 3.04-3.07 — EITC thresholds and phase-outs
 *   Form: Schedule EIC (Form 1040)
 *   Pub: Publication 596 — Earned Income Credit
 * @see https://www.irs.gov/irb/2024-44_IRB#REV-PROC-2024-40
 * @scope Full EITC computation with qualifying children
 * @limitations Investment income disqualification at $11,950 limit, does not model tie-breaker rules for shared dependents
 *
 * @param filingStatus        - The taxpayer's filing status.
 * @param earnedIncome        - Wages, salaries, self-employment income, etc.
 * @param agi                 - Adjusted gross income.
 * @param qualifyingChildren  - Number of qualifying children (0+).
 * @param investmentIncome    - Total investment income (interest, dividends,
 *                              capital gains, etc.).
 * @param taxpayerDateOfBirth - Taxpayer's date of birth (for age check on 0-child EITC).
 * @param taxYear             - Tax year (for age calculation).
 * @returns The EITC amount (0 if ineligible).
 */
export function calculateEITC(
  filingStatus: FilingStatus,
  earnedIncome: number,
  agi: number,
  qualifyingChildren: number,
  investmentIncome: number,
  taxpayerDateOfBirth?: string,
  taxYear: number = 2025,
  livedApartFromSpouse?: boolean,
): number {
  // ── Disqualifying conditions ──────────────────────────────────────────

  // MFS filers are generally ineligible for the EITC.
  // Exception (ARPA 2021 §9621, made permanent): MFS filers may claim EITC if they
  // have a qualifying child AND lived apart from their spouse for last 6 months of year.
  if (filingStatus === FilingStatus.MarriedFilingSeparately) {
    if (!(qualifyingChildren > 0 && livedApartFromSpouse)) {
      return 0;
    }
  }

  // Investment income exceeds the limit.
  if (investmentIncome > INVESTMENT_INCOME_LIMIT) {
    return 0;
  }

  // No earned income means no credit.
  if (earnedIncome <= 0) {
    return 0;
  }

  // Age requirement for childless filers: must be at least 25 and under 65.
  // If DOB is not provided for a childless filer, deny the credit (conservative)
  // rather than silently allowing ineligible filers.
  if (qualifyingChildren === 0) {
    if (!taxpayerDateOfBirth) {
      return 0; // Cannot verify age — deny EITC for safety
    }
    const age = getAgeAtEndOfYear(taxpayerDateOfBirth, taxYear);
    if (age !== null && (age < EITC_MIN_AGE_NO_CHILDREN || age > EITC_MAX_AGE_NO_CHILDREN)) {
      return 0;
    }
  }

  // ── Determine bracket ─────────────────────────────────────────────────

  // Cap qualifying children at 3 for EITC lookup purposes.
  const childrenKey = Math.min(qualifyingChildren, 3);
  const bracket = EITC_BRACKETS[childrenKey];

  // ── Determine if MFJ for phase-out thresholds ────────────────────────
  // QSS is NOT treated as MFJ for EITC phase-out thresholds.
  // IRC §32(c)(1)(A)(ii) defines "eligible individual" using specific filing status language;
  // QSS filers use single phase-out thresholds per IRS Schedule EIC instructions.

  const isMFJ = filingStatus === FilingStatus.MarriedFilingJointly;

  // ── Compute credit using both earned income and AGI ───────────────────
  // The IRS rule: use whichever income measure produces the LOWER credit.

  const creditFromEarnedIncome = creditForIncome(earnedIncome, bracket, isMFJ);
  const creditFromAGI = creditForIncome(agi, bracket, isMFJ);

  return round2(Math.min(creditFromEarnedIncome, creditFromAGI));
}

/**
 * Calculate IRS age at end of a tax year from a date of birth string.
 * Uses parseDateString to avoid browser-dependent `new Date(string)`.
 *
 * Per IRS rules, you are considered a year older on the day before your birthday.
 * This matters for Jan 1 birthdays: a person born Jan 1, 1961 is considered 65
 * on Dec 31, 2025 (the day before their 65th birthday).
 *
 * Returns null if the date is invalid.
 */
function getAgeAtEndOfYear(dateOfBirth: string, taxYear: number): number | null {
  const dob = parseDateString(dateOfBirth);
  if (!dob) return null;
  // Simple year subtraction gives age assuming birthday has occurred.
  // For Jan 1 birthdays: they're considered the next age on Dec 31 (day before),
  // so they effectively "turn" that age in the prior year. Add 1 for Jan 1 births.
  const baseAge = taxYear - dob.year;
  if (dob.month === 0 && dob.day === 1) {
    // Born Jan 1 → considered a year older on Dec 31 of prior year
    return baseAge + 1;
  }
  return baseAge;
}
