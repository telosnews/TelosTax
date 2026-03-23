/**
 * Form 7206 — Self-Employed Health Insurance Deduction
 *
 * Introduced TY2023. Computes the deductible amount of health insurance
 * premiums for self-employed individuals (Schedule C/F filers).
 *
 * Three-part calculation:
 *   Part I  — Premium aggregation (medical/dental/vision + LTC + Medicare)
 *   Part II — Monthly proration (only months without employer coverage count)
 *   Part III — Net profit limitation (IRC §162(l)(2)(A))
 *
 * S-Corp exclusion: >2% S-Corp shareholders report health insurance on W-2
 * Box 1 and deduct via Schedule 1 Line 17 directly — they do NOT use Form 7206.
 *
 * @authority
 *   IRC §162(l) — Self-employed health insurance deduction
 *   IRC §213(d)(10) — LTC premium limits by age
 *   Rev. Proc. 2024-40 — 2025 inflation-adjusted LTC limits
 *   Form 7206 (2025) — Self-Employed Health Insurance Deduction
 */

import type { Form7206Input, Form7206Result, FilingStatus } from '../types/index.js';
import { LTC_PREMIUM_LIMITS_2025 } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Look up the per-person LTC premium limit by age at end of tax year.
 * IRC §213(d)(10) — age brackets from Rev. Proc. 2024-40.
 */
export function getLTCPremiumLimit(age: number | undefined): number {
  if (age === undefined || age === null) return 0;
  if (age <= 40) return LTC_PREMIUM_LIMITS_2025.AGE_40_OR_UNDER;
  if (age <= 50) return LTC_PREMIUM_LIMITS_2025.AGE_41_TO_50;
  if (age <= 60) return LTC_PREMIUM_LIMITS_2025.AGE_51_TO_60;
  if (age <= 70) return LTC_PREMIUM_LIMITS_2025.AGE_61_TO_70;
  return LTC_PREMIUM_LIMITS_2025.AGE_71_AND_OVER;
}

/**
 * Calculate the self-employed health insurance deduction per Form 7206.
 *
 * @param input              Form 7206 input (undefined → $0 deduction)
 * @param scheduleCNetProfit Net profit from Schedule C (may be negative)
 * @param scheduleFNetProfit Net profit from Schedule F (may be negative)
 * @param deductibleHalfSETax Deductible half of SE tax (Schedule SE Line 13)
 * @param seRetirementContributions Total SE retirement contributions (SEP + Solo 401k + other)
 * @param ptcAdjustmentAmount Actual PTC from Pub 974 iteration (0 when PTC entitlement = $0).
 *   Per IRS Pub 974, the SE health insurance deduction is reduced by the *actual* PTC
 *   (not the advance PTC from 1095-A). The caller resolves the SE health ↔ PTC circularity
 *   via iteration and passes the converged PTC here.
 * @param filingStatus       Filing status (for MFJ spouse LTC handling)
 */
export function calculateForm7206(
  input: Form7206Input | undefined,
  scheduleCNetProfit: number,
  scheduleFNetProfit: number,
  deductibleHalfSETax: number,
  seRetirementContributions: number,
  ptcAdjustmentAmount: number,
  filingStatus: FilingStatus,
): Form7206Result {
  const zero: Form7206Result = {
    medicalDentalVisionPremiums: 0,
    longTermCarePremiumsClaimed: 0,
    medicarePremiums: 0,
    totalPremiums: 0,
    eligibleMonths: 12,
    proratedPremiums: 0,
    netSEProfit: 0,
    deductibleHalfSETax: 0,
    seRetirementContributions: 0,
    adjustedNetSEProfit: 0,
    netProfitLimitedAmount: 0,
    ptcAdjustment: 0,
    finalDeduction: 0,
    taxpayerLTCLimit: 0,
    spouseLTCLimit: 0,
    warnings: [],
  };

  if (!input) return zero;

  const warnings: string[] = [];

  // ── Part I: Premium Aggregation ──────────────────────────
  const medDentalVision = Math.max(0, input.medicalDentalVisionPremiums || 0);

  // LTC: cap per person by age, then sum
  const taxpayerLTCLimit = getLTCPremiumLimit(input.taxpayerAge);
  const spouseLTCLimit = getLTCPremiumLimit(input.spouseAge);

  let cappedLTC = 0;
  if (input.longTermCarePremiums && input.longTermCarePremiums > 0) {
    if (input.taxpayerLTCPremium !== undefined || input.spouseLTCPremium !== undefined) {
      // Per-person split provided — cap each individually
      const taxpayerLTC = Math.min(Math.max(0, input.taxpayerLTCPremium || 0), taxpayerLTCLimit);
      const spouseLTC = Math.min(Math.max(0, input.spouseLTCPremium || 0), spouseLTCLimit);
      cappedLTC = round2(taxpayerLTC + spouseLTC);
    } else {
      // No per-person split — cap total at combined limit (both ages if known)
      const combinedLimit = taxpayerLTCLimit + spouseLTCLimit;
      cappedLTC = Math.min(input.longTermCarePremiums, combinedLimit);
    }

    if (cappedLTC === 0 && input.longTermCarePremiums > 0 && input.taxpayerAge === undefined) {
      warnings.push(
        'LTC premiums entered but taxpayer age not provided. Age is required for the ' +
        'IRC §213(d)(10) age-based limit calculation. Please provide your age to claim LTC premiums.',
      );
    } else if (input.longTermCarePremiums > cappedLTC) {
      warnings.push(
        `LTC premiums reduced from $${input.longTermCarePremiums.toLocaleString()} to $${cappedLTC.toLocaleString()} ` +
        `due to IRC §213(d)(10) age-based limits.`,
      );
    }
  }

  const medicare = Math.max(0, input.medicarePremiums || 0);
  const totalPremiums = round2(medDentalVision + cappedLTC + medicare);

  // ── Part II: Monthly Proration ───────────────────────────
  let eligibleMonths = 12;
  if (input.monthlyEligibility) {
    const tp = input.monthlyEligibility.taxpayerEligibleForEmployerPlan;
    const sp = input.monthlyEligibility.spouseEligibleForEmployerPlan;
    eligibleMonths = 0;
    for (let m = 0; m < 12; m++) {
      const taxpayerHadEmployerPlan = tp[m] === true;
      const spouseHadEmployerPlan = sp ? sp[m] === true : false;
      // A month is eligible for SEHI if NEITHER taxpayer nor spouse had employer coverage
      if (!taxpayerHadEmployerPlan && !spouseHadEmployerPlan) {
        eligibleMonths++;
      }
    }
  }

  const proratedPremiums = eligibleMonths === 12
    ? totalPremiums
    : round2(totalPremiums * eligibleMonths / 12);

  // ── Part III: Net Profit Limitation ──────────────────────
  // IRC §162(l)(2)(A): Limited to net SE profit minus deductible half of SE tax
  // minus SE retirement contributions
  const netSEProfit = Math.max(0, scheduleCNetProfit + scheduleFNetProfit);
  const adjustedNetSEProfit = Math.max(0, round2(netSEProfit - deductibleHalfSETax - seRetirementContributions));
  const netProfitLimitedAmount = Math.min(proratedPremiums, adjustedNetSEProfit);

  if (proratedPremiums > adjustedNetSEProfit && proratedPremiums > 0) {
    warnings.push(
      `Health insurance deduction limited to $${adjustedNetSEProfit.toLocaleString()} ` +
      `(adjusted net SE profit) instead of $${proratedPremiums.toLocaleString()} in premiums.`,
    );
  }

  // PTC adjustment: actual PTC (from Pub 974 iteration) reduces the deduction.
  // The caller resolves the SE health ↔ PTC circularity and passes the converged PTC.
  // When PTC entitlement = $0, ptcAdjustmentAmount = 0 → deduction = full premiums.
  const ptcAdjustment = Math.max(0, ptcAdjustmentAmount);
  const finalDeduction = Math.max(0, round2(netProfitLimitedAmount - ptcAdjustment));

  return {
    medicalDentalVisionPremiums: medDentalVision,
    longTermCarePremiumsClaimed: cappedLTC,
    medicarePremiums: medicare,
    totalPremiums,
    eligibleMonths,
    proratedPremiums,
    netSEProfit,
    deductibleHalfSETax,
    seRetirementContributions,
    adjustedNetSEProfit,
    netProfitLimitedAmount,
    ptcAdjustment,
    finalDeduction,
    taxpayerLTCLimit,
    spouseLTCLimit,
    warnings,
  };
}

/**
 * Bridge function: converts the legacy single-field healthInsurancePremiums
 * into a Form7206Input for backward compatibility.
 */
export function legacyToForm7206Input(healthInsurancePremiums: number): Form7206Input {
  return { medicalDentalVisionPremiums: healthInsurancePremiums };
}
