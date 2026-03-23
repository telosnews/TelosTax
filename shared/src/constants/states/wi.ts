/**
 * Wisconsin State Tax Constants — Tax Year 2025
 *
 * Sources:
 *   - Wis. Stat. §71.06 — Wisconsin income tax rates
 *   - Wis. Stat. §71.05(22) — Standard deduction sliding scale
 *   - Wis. Stat. §71.05(23) — Personal exemptions
 *   - Wisconsin Form 1 — Individual Income Tax Return
 *   - Wisconsin Schedule WD — Capital Gains and Losses
 *   - WI DOR Tax Bulletin — 2025 indexed amounts
 */

import { StateTaxBracket } from '../../types/index.js';

// ─── WI Income Tax Brackets (2025) ──────────────────────────────
// 4 progressive brackets per filing status

export const WI_BRACKETS: Record<string, StateTaxBracket[]> = {
  single: [
    { min: 0,       max: 14680,   rate: 0.035 },
    { min: 14680,   max: 29370,   rate: 0.044 },
    { min: 29370,   max: 323290,  rate: 0.053 },
    { min: 323290,  max: Infinity, rate: 0.0765 },
  ],
  married_joint: [
    { min: 0,       max: 19580,   rate: 0.035 },
    { min: 19580,   max: 39150,   rate: 0.044 },
    { min: 39150,   max: 431060,  rate: 0.053 },
    { min: 431060,  max: Infinity, rate: 0.0765 },
  ],
  married_separate: [
    { min: 0,       max: 9790,    rate: 0.035 },
    { min: 9790,    max: 19575,   rate: 0.044 },
    { min: 19575,   max: 215530,  rate: 0.053 },
    { min: 215530,  max: Infinity, rate: 0.0765 },
  ],
  head_of_household: [
    { min: 0,       max: 14680,   rate: 0.035 },
    { min: 14680,   max: 51130,   rate: 0.044 },
    { min: 51130,   max: 323290,  rate: 0.053 },
    { min: 323290,  max: Infinity, rate: 0.0765 },
  ],
};

// ─── WI Standard Deduction — Sliding Scale (2025) ───────────────
// Wisconsin uses a non-linear sliding-scale standard deduction that
// phases out to $0 for high earners. The deduction starts at a base
// amount and is reduced by a fixed amount per $1,000 (or fraction
// thereof) that income exceeds a threshold.
//
// Formula: deduction = max(0, baseAmount - reductionPerK * ceil((income - threshold) / 1000))
//
// The deduction cannot go below $0.

export interface WIStandardDeductionParams {
  baseAmount: number;        // Starting standard deduction amount
  phaseoutStart: number;     // Income threshold where phaseout begins
  reductionRate: number;     // Per-dollar reduction rate (continuous, per WI Act 15)
  /** Optional second-stage phaseout (HoH only for TY2025). */
  stage2?: {
    phaseoutStart: number;   // Income threshold where stage 2 begins
    reductionRate: number;   // Per-dollar reduction rate for stage 2
  };
}

// Source: PolicyEngine (cites WI DOR 2025 Form 1 instructions pp.35-37, WI Act 15)
export const WI_STANDARD_DEDUCTION: Record<string, WIStandardDeductionParams> = {
  single: {
    baseAmount: 13560,
    phaseoutStart: 19550,
    reductionRate: 0.12,
  },
  married_joint: {
    baseAmount: 25110,
    phaseoutStart: 28210,
    reductionRate: 0.19778,
  },
  married_separate: {
    baseAmount: 11930,
    phaseoutStart: 13390,
    reductionRate: 0.19778,
  },
  head_of_household: {
    baseAmount: 17520,
    phaseoutStart: 19550,
    reductionRate: 0.22515,
    stage2: {
      phaseoutStart: 57210,
      reductionRate: 0.12,
    },
  },
};

// ─── WI Personal & Dependent Exemptions (2025) ──────────────────
// $700 per taxpayer (and spouse if MFJ), $700 per dependent
export const WI_PERSONAL_EXEMPTION = 700;
export const WI_DEPENDENT_EXEMPTION = 700;

// ─── WI EITC (2025) ─────────────────────────────────────────────
// Wisconsin EITC is a percentage of the federal EITC, varying by
// number of qualifying children.
//   - 1 child:   4% of federal EITC
//   - 2 children: 11% of federal EITC
//   - 3+ children: 34% of federal EITC
//   - 0 children: NOT eligible for WI EITC
//
// The WI EITC is refundable.
export const WI_EITC_RATES: Record<number, number> = {
  0: 0,       // No WI EITC for childless filers
  1: 0.04,    // 4% of federal EITC
  2: 0.11,    // 11% of federal EITC
  3: 0.34,    // 34% of federal EITC (3 or more children)
};
