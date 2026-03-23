import { FilingStatus, ScheduleRInfo, ScheduleRResult } from '../types/index.js';
import { SCHEDULE_R } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate Schedule R — Credit for the Elderly or the Disabled (Form 1040).
 *
 * IRC §22 provides a credit for taxpayers who are:
 *   1. Age 65 or older, OR
 *   2. Under 65, retired on permanent and total disability, and received taxable disability income.
 *
 * The credit is 15% of the "initial amount" (based on filing status), reduced by:
 *   A. Nontaxable Social Security, railroad retirement benefits, and other nontaxable pensions
 *   B. 50% of (AGI − AGI threshold)
 *
 * Initial amounts (IRC §22(c)(2)):
 *   - Single, HoH, QSS: $5,000
 *   - MFJ, both 65+:    $7,500
 *   - MFJ, one 65+:     $5,000
 *   - MFS:               $3,750
 *
 * AGI thresholds (IRC §22(d)):
 *   - Single, HoH, QSS: $7,500
 *   - MFJ:               $10,000
 *   - MFS:               $5,000
 *
 * Note: These amounts are statutory (IRC §22) and NOT indexed for inflation.
 *
 * The credit is non-refundable (reduces tax liability to $0 floor).
 *
 * @authority
 *   IRC: Section 22 — Credit for the elderly and the permanently and totally disabled
 *   IRC: Section 22(c)(2) — Initial amounts
 *   IRC: Section 22(d) — Adjusted gross income limitation
 *   Form: Schedule R (Form 1040)
 * @scope Full Schedule R computation with nontaxable income and AGI reductions
 * @limitations Does not validate disability status or permanent/total disability certification (Form 1040 Schedule R physician's statement)
 */

/**
 * Calculate the Credit for the Elderly or the Disabled (Schedule R).
 *
 * @param info - Taxpayer/spouse age and disability status, nontaxable income
 * @param agi - Adjusted Gross Income
 * @param filingStatus - Filing status
 * @returns ScheduleRResult with credit calculation detail
 */
export function calculateScheduleR(
  info: ScheduleRInfo,
  agi: number,
  filingStatus: FilingStatus,
): ScheduleRResult {
  const zero: ScheduleRResult = {
    qualifies: false,
    initialAmount: 0,
    nontaxableReduction: 0,
    agiReduction: 0,
    creditBase: 0,
    creditRate: SCHEDULE_R.CREDIT_RATE,
    credit: 0,
  };

  // ─── Eligibility ────────────────────────────────────────
  // Must be 65+ OR under 65 and permanently/totally disabled
  const taxpayerQualifies = info.isAge65OrOlder || (info.isDisabled === true);
  const spouseQualifies = info.isSpouseAge65OrOlder || (info.isSpouseDisabled === true);

  // For MFJ, at least one must qualify
  const isMFJ = filingStatus === FilingStatus.MarriedFilingJointly;
  if (isMFJ) {
    if (!taxpayerQualifies && !spouseQualifies) return zero;
  } else {
    if (!taxpayerQualifies) return zero;
  }

  // MFS: must have lived apart for the entire year (user attestation assumed — we compute the credit)
  // The engine computes the credit; the user must verify eligibility requirements.

  // ─── Initial Amount (IRC §22(c)(2)) ─────────────────────
  let initialAmount: number;
  if (filingStatus === FilingStatus.MarriedFilingSeparately) {
    initialAmount = SCHEDULE_R.INITIAL_AMOUNT_MFS;
  } else if (isMFJ) {
    if (taxpayerQualifies && spouseQualifies) {
      initialAmount = SCHEDULE_R.INITIAL_AMOUNT_MFJ_BOTH;
    } else {
      initialAmount = SCHEDULE_R.INITIAL_AMOUNT_MFJ_ONE;
    }
  } else {
    // Single, HoH, QSS
    initialAmount = SCHEDULE_R.INITIAL_AMOUNT_SINGLE;
  }

  // For under-65 disabled filers, the initial amount is limited to taxable disability income
  // IRC §22(c)(2)(B)(iii): initial amount cannot exceed taxable disability income
  //
  // For MFJ, we must handle the combined scenario carefully:
  //   - Both under 65, both disabled → combined disability income caps the joint initial amount
  //   - One 65+, one under-65 disabled → age portion is unrestricted, disability portion is capped
  //   - Only one qualifies (non-MFJ or MFJ with one qualifying) → straightforward cap
  if (isMFJ && !info.isSpouseAge65OrOlder && info.isSpouseDisabled) {
    const spouseDisabilityIncome = Math.max(0, info.spouseTaxableDisabilityIncome || 0);
    if (!info.isAge65OrOlder && info.isDisabled) {
      // Both under 65, both disabled — combined disability income caps joint initial amount
      const combinedDisabilityIncome = round2(
        Math.max(0, info.taxableDisabilityIncome || 0) + spouseDisabilityIncome,
      );
      initialAmount = Math.min(initialAmount, combinedDisabilityIncome);
    } else if (info.isAge65OrOlder) {
      // Taxpayer 65+, spouse disabled under 65
      // Taxpayer's portion is unrestricted; spouse's portion limited to disability income
      const ageInitial = SCHEDULE_R.INITIAL_AMOUNT_MFJ_ONE; // Taxpayer 65+ portion
      const disabilityPortion = Math.min(
        SCHEDULE_R.INITIAL_AMOUNT_MFJ_BOTH - SCHEDULE_R.INITIAL_AMOUNT_MFJ_ONE,
        spouseDisabilityIncome,
      );
      initialAmount = round2(ageInitial + disabilityPortion);
    }
  } else if (!info.isAge65OrOlder && info.isDisabled) {
    // Single/HoH/QSS or MFJ where only taxpayer qualifies by disability
    const disabilityIncome = Math.max(0, info.taxableDisabilityIncome || 0);
    initialAmount = Math.min(initialAmount, disabilityIncome);
  }

  // ─── Reduction A: Nontaxable Income ─────────────────────
  // Schedule R Line 5: nontaxable SS + nontaxable pensions/annuities
  const nontaxableReduction = round2(
    Math.max(0, info.nontaxableSocialSecurity || 0) +
    Math.max(0, info.nontaxablePensions || 0),
  );

  // ─── Reduction B: AGI Phase-Out ─────────────────────────
  // Schedule R Line 7: excess of AGI over threshold, multiplied by 50%
  let agiThreshold: number;
  if (filingStatus === FilingStatus.MarriedFilingSeparately) {
    agiThreshold = SCHEDULE_R.AGI_THRESHOLD_MFS;
  } else if (isMFJ) {
    agiThreshold = SCHEDULE_R.AGI_THRESHOLD_MFJ;
  } else {
    agiThreshold = SCHEDULE_R.AGI_THRESHOLD_SINGLE;
  }

  const agiExcess = round2(Math.max(0, agi - agiThreshold));
  const agiReduction = round2(agiExcess * SCHEDULE_R.AGI_REDUCTION_RATE);

  // ─── Credit Base ────────────────────────────────────────
  const creditBase = round2(Math.max(0, initialAmount - nontaxableReduction - agiReduction));

  // ─── Credit ─────────────────────────────────────────────
  // IRC §22(a): 15% of the credit base
  const credit = round2(creditBase * SCHEDULE_R.CREDIT_RATE);

  return {
    qualifies: credit > 0,
    initialAmount,
    nontaxableReduction,
    agiReduction,
    creditBase,
    creditRate: SCHEDULE_R.CREDIT_RATE,
    credit,
  };
}
