/**
 * Alabama State Tax Constants --- Tax Year 2025
 *
 * Sources:
 *   - Ala. Code SS 40-18-5 --- Alabama income tax rates
 *   - Ala. Code SS 40-18-15 --- Standard deduction
 *   - Ala. Code SS 40-18-19 --- Personal exemptions
 *   - Alabama Form 40 Instructions pp.9-10 (2025 standard deduction table)
 *
 * Key Alabama characteristics:
 *   - UNIQUE: Taxpayers deduct federal income tax paid from Alabama taxable income
 *   - Same 3 brackets for all filing statuses: 2%, 4%, 5%
 *   - Standard deduction phases down in $500 steps ($250 for MFS) when AGI exceeds threshold
 *   - Social Security fully exempt
 *   - No state EITC
 */

import { StateTaxBracket } from '../../types/index.js';

// --- AL Income Tax Brackets (2025) ------------------------------------------
// Single/MFS/HoH: 2% on first $500, 4% on $500-$3,000, 5% on $3,000+
// MFJ: 2% on first $1,000, 4% on $1,000-$6,000, 5% on $6,000+

const AL_SINGLE_BRACKETS: StateTaxBracket[] = [
  { min: 0,     max: 500,      rate: 0.02 },
  { min: 500,   max: 3000,     rate: 0.04 },
  { min: 3000,  max: Infinity,  rate: 0.05 },
];

const AL_MFJ_BRACKETS: StateTaxBracket[] = [
  { min: 0,     max: 1000,     rate: 0.02 },
  { min: 1000,  max: 6000,     rate: 0.04 },
  { min: 6000,  max: Infinity,  rate: 0.05 },
];

export const AL_BRACKETS: Record<string, StateTaxBracket[]> = {
  single:            AL_SINGLE_BRACKETS,
  married_joint:     AL_MFJ_BRACKETS,
  married_separate:  AL_SINGLE_BRACKETS,
  head_of_household: AL_SINGLE_BRACKETS,
};

// --- AL Standard Deduction Phase-Down (2025) ---------------------------------
// The standard deduction phases down in stepped increments when AGI exceeds
// a threshold. Reduced per step (each $500 of AGI, or $250 for MFS),
// with a floor below which it cannot drop.
//
// Source: Alabama Form 40 Instructions p.9 (2025 standard deduction table)

export interface ALStandardDeductionParams {
  base: number;           // Full standard deduction (below phaseout threshold)
  phaseoutStart: number;  // AGI at which phase-down begins
  stepSize: number;       // AGI increment per step ($500 or $250 for MFS)
  reductionPerStep: number; // Deduction reduction per step
  floor: number;          // Minimum standard deduction (cannot go below this)
}

export const AL_STANDARD_DEDUCTION: Record<string, ALStandardDeductionParams> = {
  single: {
    base: 3000,
    phaseoutStart: 26000,
    stepSize: 500,
    reductionPerStep: 25,
    floor: 2500,
  },
  married_joint: {
    base: 8500,
    phaseoutStart: 26000,
    stepSize: 500,
    reductionPerStep: 175,
    floor: 5000,
  },
  married_separate: {
    base: 4250,
    phaseoutStart: 13000,
    stepSize: 250,
    reductionPerStep: 88,
    floor: 2500,
  },
  head_of_household: {
    base: 5200,
    phaseoutStart: 26000,
    stepSize: 500,
    reductionPerStep: 135,
    floor: 2500,
  },
};

// --- AL Personal Exemptions (2025) ------------------------------------------
// Flat exemption amount per filing status. Reduces taxable income directly.
export const AL_PERSONAL_EXEMPTION: Record<string, number> = {
  single: 1500,
  married_joint: 3000,
  married_separate: 1500,
  head_of_household: 3000,
};

// --- AL Dependent Exemption Phase-Down (2025) --------------------------------
// Per-dependent exemption amount decreases at higher AL AGI.
// Same thresholds apply to all filing statuses.
// Source: Alabama Form 40 Instructions p.10, Line 14
export const AL_DEPENDENT_EXEMPTION_TIERS: { maxAGI: number; amount: number }[] = [
  { maxAGI: 50000,   amount: 1000 },  // $0 - $50,000
  { maxAGI: 100000,  amount: 500 },   // $50,001 - $100,000
  // Over $100,000: $300
];
export const AL_DEPENDENT_EXEMPTION_FLOOR = 300;
