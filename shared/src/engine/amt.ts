/**
 * Alternative Minimum Tax (AMT) — Form 6251, Tax Year 2025
 *
 * The AMT is a parallel tax system designed to ensure high-income taxpayers
 * pay at least a minimum amount of tax, even with many deductions.
 *
 * Calculation flow (Form 6251):
 *   Part I — Alternative Minimum Taxable Income (AMTI)
 *     1. Start with taxable income (Line 1)
 *     2. Add back AMT adjustments (Lines 2a–3)
 *     3. Result = AMTI (Line 4)
 *   Part II — AMT Computation
 *     5. Subtract AMT exemption with phase-out (Line 5)
 *     6. Apply AMT rates (26%/28%) or Part III → tentative minimum tax (Line 7)
 *     7. Subtract AMTFTC (Line 8) → TMT after FTC (Line 9)
 *     8. AMT = max(0, TMT after FTC - regular tax) (Lines 10–11)
 *   Part III — Capital Gains Rates for AMT (if LTCG/QD present)
 *     Uses 0%/15%/20%/25% on cap gains portion, 26%/28% on ordinary portion
 *     TMT = min(Part III result, flat 26%/28%)
 *
 * @authority
 *   IRC: Section 55 — Alternative Minimum Tax imposed
 *   IRC: Section 56 — Adjustments in computing AMTI
 *   IRC: Section 57 — Items of tax preference
 *   Form: Form 6251
 *   Pub: Publication 17, Chapter 33
 *   Rev Proc 2024-40 — 2025 inflation-adjusted amounts
 * @scope AMT for individuals (Form 6251), including Part III preferential rates
 */

import { FilingStatus, TaxReturn, ScheduleAResult } from '../types/index.js';
import { AMT_2025 } from '../constants/amt2025.js';
import { CAPITAL_GAINS_RATES } from '../constants/tax2025.js';
import { round2 } from './utils.js';

// ─── Result Types ────────────────────────────────────────

/**
 * Part III result — preferential capital gains rates applied against AMT base.
 * When LTCG/QD exist, Part III may produce a lower TMT than flat 26%/28%.
 */
export interface AMTPartIIIResult {
  /** AMT base going into Part III (same as Part II Line 6) */
  amtBase: number;
  /** Adjusted net capital gain = QD + LTCG (capped at AMT base) */
  adjustedNetCapitalGain: number;
  /** Ordinary AMT income = AMT base - adjusted net capital gain */
  ordinaryAMTIncome: number;
  /** Tax on ordinary portion at 26%/28% */
  ordinaryTax: number;
  /** Tax on LTCG/QD at 0%/15%/20% */
  capitalGainsTax: number;
  /** Tax on unrecaptured §1250 gain at 25% */
  section1250Tax: number;
  /** Special computation tax (ordinary + §1250 + preferential) */
  specialComputationTax: number;
  /** Flat-rate tax: 26%/28% on entire AMT base (comparison) */
  flatRateTax: number;
  /** Tentative minimum tax = min(special, flat) */
  tentativeMinimumTax: number;
}

/**
 * Full Form 6251 result with line-by-line breakdown.
 */
export interface AMTResult {
  // ── Part I: AMTI ──

  /** Line 1: Regular taxable income starting point */
  line1_taxableIncome: number;

  /** Detailed breakdown of all Part I adjustments (Lines 2a–3) */
  adjustments: {
    /** Line 2a: Standard deduction add-back */
    standardDeductionAddBack: number;
    /** Line 2b: Tax refund adjustment */
    taxRefundAdjustment: number;
    /** Line 2c: Investment interest expense difference */
    investmentInterestAdjustment: number;
    /** Line 2d: Depletion difference */
    depletion: number;
    /** Line 2e: SALT deduction added back (auto-computed from Schedule A) */
    saltAddBack: number;
    /** Line 2f: Alternative tax net operating loss deduction */
    atnold: number;
    /** Line 2g: Private activity bond interest */
    privateActivityBondInterest: number;
    /** Line 2h: Qualified small business stock exclusion (§1202) */
    qsbsExclusion: number;
    /** Line 2i: ISO exercise spread */
    isoExerciseSpread: number;
    /** Line 2k: Disposition of property difference */
    dispositionOfProperty: number;
    /** Line 2l: Depreciation adjustment (ADS vs MACRS) */
    depreciationAdjustment: number;
    /** Line 2m: Passive activity loss difference */
    passiveActivityLoss: number;
    /** Line 2n: Loss limitation difference */
    lossLimitations: number;
    /** Line 2o: Circulation costs */
    circulationCosts: number;
    /** Line 2p: Long-term contracts difference */
    longTermContracts: number;
    /** Line 2q: Mining costs */
    miningCosts: number;
    /** Line 2r: Research and experimental costs */
    researchCosts: number;
    /** Line 2t: Intangible drilling costs */
    intangibleDrillingCosts: number;
    /** Line 3: Other adjustments (catch-all) */
    otherAdjustments: number;
    /** Total of all adjustments (sum of lines 2a–3) */
    total: number;
  };

  // ── Part II: AMT Computation ──

  /** Line 4: Alternative Minimum Taxable Income (taxableIncome + adjustments.total) */
  amti: number;
  /** Line 5: AMT exemption amount (after phase-out) */
  exemption: number;
  /** Line 6: AMT base = AMTI - exemption */
  amtBase: number;
  /** Line 7: Tentative minimum tax (from flat rates or Part III) */
  tentativeMinimumTax: number;
  /** Line 8: AMT foreign tax credit */
  amtForeignTaxCredit: number;
  /** Line 9: TMT after foreign tax credit = Line 7 - Line 8 */
  tmtAfterFTC: number;
  /** Line 10: Regular income tax (for comparison) */
  regularTax: number;
  /** Line 11: AMT amount = max(0, Line 9 - Line 10) */
  amtAmount: number;
  /** Whether AMT applies (amtAmount > 0) */
  applies: boolean;

  // ── Part III (optional) ──

  /** Part III result when capital gains preferential rates used */
  partIII?: AMTPartIIIResult;
  /** Whether Part III was used for TMT computation */
  usedPartIII: boolean;
}

// ─── Main Calculator ─────────────────────────────────────

/**
 * Calculate the Alternative Minimum Tax (full Form 6251).
 *
 * @param taxReturn - Full tax return data
 * @param regularTax - Regular income tax (before credits) — comparison point
 * @param scheduleA - Schedule A result (if itemizing)
 * @param taxableIncome - Regular taxable income (Form 1040 Line 15)
 * @param filingStatus - Filing status
 * @param deductionAmount - The deduction amount (standard or itemized) used on Form 1040 Line 12
 * @param qualifiedDividends - Qualified dividends for Part III
 * @param longTermCapitalGains - Net LTCG for Part III
 * @param unrecapturedSection1250Gain - Unrecaptured §1250 gain for Part III
 */
export function calculateAMT(
  taxReturn: TaxReturn,
  regularTax: number,
  scheduleA: ScheduleAResult | undefined,
  taxableIncome: number,
  filingStatus: FilingStatus,
  deductionAmount?: number,
  qualifiedDividends?: number,
  longTermCapitalGains?: number,
  unrecapturedSection1250Gain?: number,
): AMTResult {
  const amtData = taxReturn.amtData;

  // ══════════════════════════════════════════════════════════
  // Part I: Alternative Minimum Taxable Income (AMTI)
  // Lines 1–4 of Form 6251
  // ══════════════════════════════════════════════════════════

  // Line 1: Start with regular taxable income
  const line1 = taxableIncome;

  // ── Lines 2a–3: AMT Adjustments ──

  // Line 2a: Standard deduction add-back
  // The AMT does not allow the standard deduction — it uses its own exemption
  const standardDeductionAddBack = (taxReturn.deductionMethod !== 'itemized' && deductionAmount)
    ? deductionAmount
    : 0;

  // Line 2b: Tax refund adjustment (state/local tax refund reported on 1040)
  // Form 6251 Line 2b is always a negative adjustment (reduces AMTI).
  // The UI collects this as a positive number, so we negate it here.
  const taxRefundAdjustment = -Math.abs(amtData?.taxRefundAdjustment || 0);

  // Line 2c: Investment interest expense difference (AMT vs regular)
  const investmentInterestAdjustment = amtData?.investmentInterestAdjustment || 0;

  // Line 2d: Depletion difference
  const depletion = amtData?.depletion || 0;

  // Line 2e: SALT deduction — fully added back for AMT (auto-computed)
  const saltAddBack = (taxReturn.deductionMethod === 'itemized' && scheduleA)
    ? scheduleA.saltDeduction
    : 0;

  // Line 2f: Alternative tax net operating loss deduction (ATNOLD)
  // Form 6251 Line 2f is always a negative adjustment (reduces AMTI).
  // The UI collects this as a positive number, so we negate it here.
  const atnold = -Math.abs(amtData?.atnold || 0);

  // Line 2g: Private activity bond interest (from municipal bonds)
  const privateActivityBondInterest = amtData?.privateActivityBondInterest || 0;

  // Line 2h: Qualified small business stock exclusion (§1202)
  const qsbsExclusion = amtData?.qsbsExclusion || 0;

  // Line 2i: ISO exercise spread (FMV - exercise price at exercise)
  const isoExerciseSpread = amtData?.isoExerciseSpread || 0;

  // Line 2k: Disposition of property difference (AMT vs regular basis)
  const dispositionOfProperty = amtData?.dispositionOfProperty || 0;

  // Line 2l: Post-1986 depreciation adjustment (ADS vs MACRS difference)
  const depreciationAdjustment = amtData?.depreciationAdjustment || 0;

  // Line 2m: Passive activity loss difference
  const passiveActivityLoss = amtData?.passiveActivityLoss || 0;

  // Line 2n: Loss limitation difference
  const lossLimitations = amtData?.lossLimitations || 0;

  // Line 2o: Circulation costs
  const circulationCosts = amtData?.circulationCosts || 0;

  // Line 2p: Long-term contracts difference
  const longTermContracts = amtData?.longTermContracts || 0;

  // Line 2q: Mining costs
  const miningCosts = amtData?.miningCosts || 0;

  // Line 2r: Research and experimental costs
  const researchCosts = amtData?.researchCosts || 0;

  // Line 2t: Intangible drilling costs
  const intangibleDrillingCosts = amtData?.intangibleDrillingCosts || 0;

  // Line 3: Other adjustments (catch-all)
  const otherAdjustments = amtData?.otherAMTAdjustments || 0;

  // Total adjustments (Lines 2a–3)
  const totalAdjustments = round2(
    standardDeductionAddBack +
    taxRefundAdjustment +
    investmentInterestAdjustment +
    depletion +
    saltAddBack +
    atnold +
    privateActivityBondInterest +
    qsbsExclusion +
    isoExerciseSpread +
    dispositionOfProperty +
    depreciationAdjustment +
    passiveActivityLoss +
    lossLimitations +
    circulationCosts +
    longTermContracts +
    miningCosts +
    researchCosts +
    intangibleDrillingCosts +
    otherAdjustments
  );

  // Line 4: AMTI = taxable income + total adjustments
  const amti = round2(Math.max(0, line1 + totalAdjustments));

  // ══════════════════════════════════════════════════════════
  // Part II: AMT Computation (Lines 5–11)
  // ══════════════════════════════════════════════════════════

  // Line 5: AMT exemption (with phase-out)
  const exemption = calculateExemption(amti, filingStatus);

  // Line 6: AMT base = AMTI - exemption
  const amtBase = round2(Math.max(0, amti - exemption));

  // Line 7: Tentative minimum tax
  // If taxpayer has qualified dividends or LTCG, use Part III (preferential rates)
  // Otherwise, use flat 26%/28% rates
  const qd = qualifiedDividends || 0;
  const ltcg = longTermCapitalGains || 0;
  const s1250 = unrecapturedSection1250Gain || 0;

  let tentativeMinimumTax: number;
  let partIII: AMTPartIIIResult | undefined;
  let usedPartIII = false;

  if ((qd > 0 || ltcg > 0) && amtBase > 0) {
    // Part III: preferential capital gains rates applied to AMT base
    partIII = calculateAMTPartIII(amtBase, qd, ltcg, s1250, filingStatus);
    tentativeMinimumTax = partIII.tentativeMinimumTax;
    usedPartIII = true;
  } else {
    // Flat 26%/28% on entire AMT base
    tentativeMinimumTax = calculateFlatTMT(amtBase, filingStatus);
  }

  // Line 8: AMT foreign tax credit
  const amtForeignTaxCredit = Math.min(
    amtData?.amtForeignTaxCredit || 0,
    tentativeMinimumTax,  // Can't exceed TMT
  );

  // Line 9: TMT after foreign tax credit
  const tmtAfterFTC = round2(Math.max(0, tentativeMinimumTax - amtForeignTaxCredit));

  // Line 10: Regular income tax minus FTC (Schedule 3, line 1)
  // Note: At initial calculation time, the regular FTC may not yet be known.
  // The caller (form1040Sections.ts) adjusts regularTax and amtAmount after
  // the FTC is computed. See adjustAMTForRegularFTC() below.
  // Line 11: AMT = max(0, Line 9 - Line 10)
  const amtAmount = round2(Math.max(0, tmtAfterFTC - regularTax));

  return {
    line1_taxableIncome: line1,
    adjustments: {
      standardDeductionAddBack,
      taxRefundAdjustment,
      investmentInterestAdjustment,
      depletion,
      saltAddBack,
      atnold,
      privateActivityBondInterest,
      qsbsExclusion,
      isoExerciseSpread,
      dispositionOfProperty,
      depreciationAdjustment,
      passiveActivityLoss,
      lossLimitations,
      circulationCosts,
      longTermContracts,
      miningCosts,
      researchCosts,
      intangibleDrillingCosts,
      otherAdjustments,
      total: totalAdjustments,
    },
    amti,
    exemption,
    amtBase,
    tentativeMinimumTax,
    amtForeignTaxCredit,
    tmtAfterFTC,
    regularTax,
    amtAmount,
    applies: amtAmount > 0,
    partIII,
    usedPartIII,
  };
}

// ─── Part III: Capital Gains Rates for AMT ──────────────

/**
 * Calculate tentative minimum tax using preferential capital gains rates.
 * Mirrors Form 6251 Part III (Lines 12–40).
 *
 * When a taxpayer has qualified dividends or LTCG, the AMT should use
 * the same 0%/15%/20%/25% preferential rates on the capital gains portion
 * rather than the flat 26%/28% AMT rates. The ordinary (non-cap-gains)
 * portion still uses 26%/28%.
 *
 * TMT = min(special computation, flat 26%/28% on entire base)
 *
 * @limitations Does not compute 28% rate on collectibles gain (mirrors
 *   capitalGains.ts). Collectibles gain is treated at the standard 15%/20%
 *   preferential rates, which may slightly understate AMT for rare cases.
 */
export function calculateAMTPartIII(
  amtBase: number,
  qualifiedDividends: number,
  longTermCapitalGains: number,
  unrecapturedSection1250Gain: number,
  filingStatus: FilingStatus,
): AMTPartIIIResult {
  if (amtBase <= 0) {
    return {
      amtBase: 0,
      adjustedNetCapitalGain: 0,
      ordinaryAMTIncome: 0,
      ordinaryTax: 0,
      capitalGainsTax: 0,
      section1250Tax: 0,
      specialComputationTax: 0,
      flatRateTax: 0,
      tentativeMinimumTax: 0,
    };
  }

  // Flat rate tax for comparison (26%/28% on entire AMT base)
  const flatRateTax = calculateFlatTMT(amtBase, filingStatus);

  // Adjusted net capital gain = QD + LTCG, capped at AMT base
  const adjustedNetCapitalGain = Math.min(
    round2(qualifiedDividends + longTermCapitalGains),
    amtBase,
  );

  // If no capital gains, flat rate is the answer
  if (adjustedNetCapitalGain <= 0) {
    return {
      amtBase,
      adjustedNetCapitalGain: 0,
      ordinaryAMTIncome: amtBase,
      ordinaryTax: flatRateTax,
      capitalGainsTax: 0,
      section1250Tax: 0,
      specialComputationTax: flatRateTax,
      flatRateTax,
      tentativeMinimumTax: flatRateTax,
    };
  }

  // Ordinary AMT income = AMT base minus capital gains portion
  const ordinaryAMTIncome = round2(amtBase - adjustedNetCapitalGain);

  // Tax on ordinary portion at 26%/28%
  const ordinaryTax = calculateFlatTMT(ordinaryAMTIncome, filingStatus);

  // Cap §1250 gain to actual LTCG and to the capital gains portion
  const effective1250 = Math.min(
    Math.max(0, unrecapturedSection1250Gain),
    Math.max(0, longTermCapitalGains),
    adjustedNetCapitalGain,
  );

  // §1250 gain taxed at 25%
  const section1250Tax = round2(effective1250 * CAPITAL_GAINS_RATES.RATE_25);

  // Remaining preferential income (LTCG + QD minus §1250) → 0%/15%/20% zones
  const remainingPreferential = round2(adjustedNetCapitalGain - effective1250);

  let capitalGainsTax = 0;

  if (remainingPreferential > 0) {
    const threshold0 = CAPITAL_GAINS_RATES.THRESHOLD_0[filingStatus];
    const threshold15 = CAPITAL_GAINS_RATES.THRESHOLD_15[filingStatus];

    // Capital gains stack on top of ordinary AMT income + §1250
    const prefStart = round2(ordinaryAMTIncome + effective1250);
    const prefEnd = round2(prefStart + remainingPreferential);

    // Portion in 0% zone
    const in0Zone = Math.max(0, Math.min(prefEnd, threshold0) - prefStart);
    // Portion in 15% zone
    const in15Zone = Math.max(0, Math.min(prefEnd, threshold15) - Math.max(prefStart, threshold0));
    // Portion in 20% zone
    const in20Zone = Math.max(0, prefEnd - Math.max(prefStart, threshold15));

    capitalGainsTax = round2(
      in0Zone * CAPITAL_GAINS_RATES.RATE_0 +
      in15Zone * CAPITAL_GAINS_RATES.RATE_15 +
      in20Zone * CAPITAL_GAINS_RATES.RATE_20,
    );
  }

  // Special computation = ordinary tax + §1250 tax + preferential tax
  const specialComputationTax = round2(ordinaryTax + section1250Tax + capitalGainsTax);

  // TMT = min(special, flat) — preferential rates never increase AMT
  const tentativeMinimumTax = Math.min(specialComputationTax, flatRateTax);

  return {
    amtBase,
    adjustedNetCapitalGain,
    ordinaryAMTIncome,
    ordinaryTax,
    capitalGainsTax,
    section1250Tax,
    specialComputationTax,
    flatRateTax,
    tentativeMinimumTax,
  };
}

// ─── Exemption Calculation ───────────────────────────────

/**
 * Calculate the AMT exemption amount after phase-out.
 *
 * The exemption is reduced by 25 cents for every dollar of AMTI
 * above the phase-out threshold. At a certain income level, the
 * exemption is completely phased out.
 */
function calculateExemption(amti: number, filingStatus: FilingStatus): number {
  const baseExemption = getExemptionAmount(filingStatus);
  const phaseOutStart = getPhaseOutThreshold(filingStatus);

  if (amti <= phaseOutStart) {
    return baseExemption;
  }

  // Reduce by 25% of excess over threshold
  const excess = amti - phaseOutStart;
  const reduction = round2(excess * 0.25);
  return round2(Math.max(0, baseExemption - reduction));
}

function getExemptionAmount(filingStatus: FilingStatus): number {
  switch (filingStatus) {
    case FilingStatus.MarriedFilingJointly:
    case FilingStatus.QualifyingSurvivingSpouse:
      return AMT_2025.EXEMPTION.MFJ;
    case FilingStatus.MarriedFilingSeparately:
      return AMT_2025.EXEMPTION.MFS;
    case FilingStatus.HeadOfHousehold:
      return AMT_2025.EXEMPTION.HOH;
    case FilingStatus.Single:
    default:
      return AMT_2025.EXEMPTION.SINGLE;
  }
}

function getPhaseOutThreshold(filingStatus: FilingStatus): number {
  switch (filingStatus) {
    case FilingStatus.MarriedFilingJointly:
    case FilingStatus.QualifyingSurvivingSpouse:
      return AMT_2025.PHASE_OUT.MFJ;
    case FilingStatus.MarriedFilingSeparately:
      return AMT_2025.PHASE_OUT.MFS;
    case FilingStatus.HeadOfHousehold:
      return AMT_2025.PHASE_OUT.HOH;
    case FilingStatus.Single:
    default:
      return AMT_2025.PHASE_OUT.SINGLE;
  }
}

// ─── Tentative Minimum Tax (flat 26%/28%) ────────────────

/**
 * Apply the AMT two-bracket rate structure:
 * - 26% on the first $239,100 ($119,550 MFS)
 * - 28% on the remainder
 *
 * Exported for use by Part III (ordinary income portion) and Part II (fallback).
 */
export function calculateFlatTMT(amtBase: number, filingStatus: FilingStatus): number {
  if (amtBase <= 0) return 0;

  const threshold = getRateThreshold(filingStatus);

  if (amtBase <= threshold) {
    return round2(amtBase * AMT_2025.RATES.LOW);
  }

  const lowBracketTax = round2(threshold * AMT_2025.RATES.LOW);
  const highBracketTax = round2((amtBase - threshold) * AMT_2025.RATES.HIGH);
  return round2(lowBracketTax + highBracketTax);
}

function getRateThreshold(filingStatus: FilingStatus): number {
  switch (filingStatus) {
    case FilingStatus.MarriedFilingSeparately:
      return AMT_2025.RATE_THRESHOLD.MFS;
    default:
      return AMT_2025.RATE_THRESHOLD.SINGLE; // Same for all others
  }
}

// ─── FTC Adjustment ─────────────────────────────────────

/**
 * Adjust the AMT result for the regular Foreign Tax Credit.
 *
 * Form 6251, Line 10 = regular income tax minus FTC (Schedule 3, line 1).
 * Since the FTC is computed after the initial AMT calculation, this function
 * retroactively adjusts the AMT comparison to use the correct net regular tax.
 *
 * This increases AMT (or causes it to apply) when it otherwise wouldn't,
 * because the regular tax base for comparison is reduced by FTC.
 */
export function adjustAMTForRegularFTC(result: AMTResult, regularFTC: number): AMTResult {
  if (regularFTC <= 0) return result;

  const adjustedRegularTax = round2(Math.max(0, result.regularTax - regularFTC));
  const adjustedAMT = round2(Math.max(0, result.tmtAfterFTC - adjustedRegularTax));

  return {
    ...result,
    regularTax: adjustedRegularTax,
    amtAmount: adjustedAMT,
    applies: adjustedAMT > 0,
  };
}
