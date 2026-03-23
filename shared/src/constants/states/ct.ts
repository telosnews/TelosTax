/**
 * Connecticut State Tax Constants — Tax Year 2025
 *
 * Sources:
 *   - CT Gen. Stat. §12-700 — Connecticut income tax rates
 *   - CT Gen. Stat. §12-702 — Personal exemptions
 *   - CT Gen. Stat. §12-703 — Personal tax credit (Table E)
 *   - CT Gen. Stat. §12-700(b) — 2% rate phase-out (Table C) and benefit recapture (Table D)
 *   - CT Gen. Stat. §12-704e — Connecticut EITC (40% of federal EITC + $250/child for TY2025)
 *   - CT DRS Form CT-1040 TCS — Tax Calculation Schedule
 *   - CT DRS TPG-211 (2025) — Withholding calculation rules
 */

import { StateTaxBracket } from '../../types/index.js';

// ─── CT Income Tax Brackets (2025) — Table B ────────────────────
// 7 progressive brackets per filing status

export const CT_BRACKETS: Record<string, StateTaxBracket[]> = {
  single: [
    { min: 0,       max: 10000,   rate: 0.02 },
    { min: 10000,   max: 50000,   rate: 0.045 },
    { min: 50000,   max: 100000,  rate: 0.055 },
    { min: 100000,  max: 200000,  rate: 0.06 },
    { min: 200000,  max: 250000,  rate: 0.065 },
    { min: 250000,  max: 500000,  rate: 0.069 },
    { min: 500000,  max: Infinity, rate: 0.0699 },
  ],
  married_joint: [
    { min: 0,       max: 20000,    rate: 0.02 },
    { min: 20000,   max: 100000,   rate: 0.045 },
    { min: 100000,  max: 200000,   rate: 0.055 },
    { min: 200000,  max: 400000,   rate: 0.06 },
    { min: 400000,  max: 500000,   rate: 0.065 },
    { min: 500000,  max: 1000000,  rate: 0.069 },
    { min: 1000000, max: Infinity,  rate: 0.0699 },
  ],
  married_separate: [
    { min: 0,       max: 10000,   rate: 0.02 },
    { min: 10000,   max: 50000,   rate: 0.045 },
    { min: 50000,   max: 100000,  rate: 0.055 },
    { min: 100000,  max: 200000,  rate: 0.06 },
    { min: 200000,  max: 250000,  rate: 0.065 },
    { min: 250000,  max: 500000,  rate: 0.069 },
    { min: 500000,  max: Infinity, rate: 0.0699 },
  ],
  head_of_household: [
    { min: 0,       max: 16000,    rate: 0.02 },
    { min: 16000,   max: 80000,    rate: 0.045 },
    { min: 80000,   max: 160000,   rate: 0.055 },
    { min: 160000,  max: 320000,   rate: 0.06 },
    { min: 320000,  max: 400000,   rate: 0.065 },
    { min: 400000,  max: 800000,   rate: 0.069 },
    { min: 800000,  max: Infinity,  rate: 0.0699 },
  ],
};

// ─── CT Personal Exemption — Table A (Deduction from Income) ────
// Connecticut has NO standard deduction. Instead the personal exemption
// amount is DEDUCTED from CT AGI to produce CT taxable income (TCS Line 2).
// The exemption amount phases out at higher income levels.

export const CT_PERSONAL_EXEMPTION: Record<string, number> = {
  single: 15000,
  married_joint: 24000,
  married_separate: 12000,
  head_of_household: 19000,
};

// ─── CT Personal Exemption Phase-Out ─────────────────────────────
// The exemption amount is reduced by $1,000 for every $1,000 of
// CT AGI over the phase-out threshold.
export const CT_EXEMPTION_PHASEOUT_START: Record<string, number> = {
  single: 30000,
  married_joint: 48000,
  married_separate: 24000,
  head_of_household: 38000,
};

// ─── Table C: 2% Tax Rate Phase-Out Add-Back ─────────────────────
// Recaptures the benefit of the lowest 2% bracket for moderate-to-high
// income taxpayers. Linear step-up over 10 bands.
// Source: CT DRS TPG-211 (2025), CT-1040 TCS Table C

export interface CTTableCParams {
  startThreshold: number;   // AGI at which add-back begins
  bandWidth: number;        // AGI per step
  incrementPerBand: number; // Add-back increase per step
  maxAddBack: number;       // Maximum add-back (= first bracket top × 2%)
}

export const CT_TABLE_C: Record<string, CTTableCParams> = {
  single: {
    startThreshold: 56500,
    bandWidth: 5000,
    incrementPerBand: 20,
    maxAddBack: 200,
  },
  married_joint: {
    startThreshold: 100500,
    bandWidth: 5000,
    incrementPerBand: 40,
    maxAddBack: 400,
  },
  married_separate: {
    startThreshold: 50250,
    bandWidth: 2500,
    incrementPerBand: 20,
    maxAddBack: 200,
  },
  head_of_household: {
    startThreshold: 78500,
    bandWidth: 4000,
    incrementPerBand: 32,
    maxAddBack: 320,
  },
};

// ─── Table D: Benefit Recapture ──────────────────────────────────
// Recaptures the benefit of ALL lower brackets for high-income taxpayers.
// Two-phase linear step-up with a plateau between phases.
// Source: CT DRS TPG-211 (2025), CT-1040 TCS Table D

export interface CTTableDParams {
  phase1: {
    startThreshold: number;
    bandWidth: number;
    incrementPerBand: number;
    plateau: number;        // Maximum for phase 1
    plateauEnd: number;     // AGI where phase 2 starts
  };
  phase2: {
    startThreshold: number;
    bandWidth: number;
    incrementPerBand: number;
    max: number;            // Overall maximum recapture
  };
}

export const CT_TABLE_D: Record<string, CTTableDParams> = {
  single: {
    phase1: {
      startThreshold: 200000,
      bandWidth: 5000,
      incrementPerBand: 90,
      plateau: 2700,
      plateauEnd: 500000,
    },
    phase2: {
      startThreshold: 500000,
      bandWidth: 5000,
      incrementPerBand: 50,
      max: 3150,
    },
  },
  married_joint: {
    phase1: {
      startThreshold: 400000,
      bandWidth: 10000,
      incrementPerBand: 180,
      plateau: 5400,
      plateauEnd: 1000000,
    },
    phase2: {
      startThreshold: 1000000,
      bandWidth: 10000,
      incrementPerBand: 100,
      max: 6300,
    },
  },
  married_separate: {
    phase1: {
      startThreshold: 200000,
      bandWidth: 5000,
      incrementPerBand: 90,
      plateau: 2700,
      plateauEnd: 500000,
    },
    phase2: {
      startThreshold: 500000,
      bandWidth: 5000,
      incrementPerBand: 50,
      max: 3150,
    },
  },
  head_of_household: {
    phase1: {
      startThreshold: 320000,
      bandWidth: 8000,
      incrementPerBand: 140,
      plateau: 4200,
      plateauEnd: 800000,
    },
    phase2: {
      startThreshold: 800000,
      bandWidth: 8000,
      incrementPerBand: 80,
      max: 4920,
    },
  },
};

// ─── Table E: Personal Tax Credit ────────────────────────────────
// Percentage-based credit applied to the combined tax (Line 7).
// Final tax = Line 7 × (1.00 - decimal).
// Array of { maxAGI, decimal } tiers — credit applies when AGI ≤ maxAGI.
// Source: CT DRS Form CT-1040 TCS Table E, TPG-211 (2025)

export interface CTTableETier {
  maxAGI: number;
  decimal: number;
}

export const CT_TABLE_E: Record<string, CTTableETier[]> = {
  single: [
    { maxAGI: 18800,  decimal: 0.75 },
    { maxAGI: 19300,  decimal: 0.70 },
    { maxAGI: 19800,  decimal: 0.65 },
    { maxAGI: 20300,  decimal: 0.60 },
    { maxAGI: 20800,  decimal: 0.55 },
    { maxAGI: 21300,  decimal: 0.50 },
    { maxAGI: 21800,  decimal: 0.45 },
    { maxAGI: 22300,  decimal: 0.40 },
    { maxAGI: 25000,  decimal: 0.35 },
    { maxAGI: 25500,  decimal: 0.30 },
    { maxAGI: 26000,  decimal: 0.25 },
    { maxAGI: 26500,  decimal: 0.20 },
    { maxAGI: 27000,  decimal: 0.15 },
    { maxAGI: 33300,  decimal: 0.14 },
    { maxAGI: 33800,  decimal: 0.13 },
    { maxAGI: 48000,  decimal: 0.12 },
    { maxAGI: 48500,  decimal: 0.11 },
    { maxAGI: 60000,  decimal: 0.10 },
    { maxAGI: 60500,  decimal: 0.09 },
    { maxAGI: 61000,  decimal: 0.08 },
    { maxAGI: 61500,  decimal: 0.07 },
    { maxAGI: 62000,  decimal: 0.06 },
    { maxAGI: 62500,  decimal: 0.05 },
    { maxAGI: 63000,  decimal: 0.04 },
    { maxAGI: 63500,  decimal: 0.03 },
    { maxAGI: 64000,  decimal: 0.02 },
    { maxAGI: 64500,  decimal: 0.01 },
    // > $64,500: 0.00
  ],
  married_joint: [
    { maxAGI: 30000,  decimal: 0.75 },
    { maxAGI: 30500,  decimal: 0.70 },
    { maxAGI: 31000,  decimal: 0.65 },
    { maxAGI: 31500,  decimal: 0.60 },
    { maxAGI: 32000,  decimal: 0.55 },
    { maxAGI: 32500,  decimal: 0.50 },
    { maxAGI: 33000,  decimal: 0.45 },
    { maxAGI: 33500,  decimal: 0.40 },
    { maxAGI: 40000,  decimal: 0.35 },
    { maxAGI: 40500,  decimal: 0.30 },
    { maxAGI: 41000,  decimal: 0.25 },
    { maxAGI: 41500,  decimal: 0.20 },
    { maxAGI: 42000,  decimal: 0.15 },
    { maxAGI: 50000,  decimal: 0.14 },
    { maxAGI: 50500,  decimal: 0.13 },
    { maxAGI: 51000,  decimal: 0.12 },
    { maxAGI: 51500,  decimal: 0.11 },
    { maxAGI: 96000,  decimal: 0.10 },
    { maxAGI: 96500,  decimal: 0.09 },
    { maxAGI: 97000,  decimal: 0.08 },
    { maxAGI: 97500,  decimal: 0.07 },
    { maxAGI: 98000,  decimal: 0.06 },
    { maxAGI: 98500,  decimal: 0.05 },
    { maxAGI: 99000,  decimal: 0.04 },
    { maxAGI: 99500,  decimal: 0.03 },
    { maxAGI: 100000, decimal: 0.02 },
    { maxAGI: 100500, decimal: 0.01 },
    // > $100,500: 0.00
  ],
  married_separate: [
    { maxAGI: 15000,  decimal: 0.75 },
    { maxAGI: 15500,  decimal: 0.70 },
    { maxAGI: 16000,  decimal: 0.65 },
    { maxAGI: 16500,  decimal: 0.60 },
    { maxAGI: 17000,  decimal: 0.55 },
    { maxAGI: 17500,  decimal: 0.50 },
    { maxAGI: 18000,  decimal: 0.45 },
    { maxAGI: 18500,  decimal: 0.40 },
    { maxAGI: 20000,  decimal: 0.35 },
    { maxAGI: 20500,  decimal: 0.30 },
    { maxAGI: 21000,  decimal: 0.25 },
    { maxAGI: 21500,  decimal: 0.20 },
    { maxAGI: 25000,  decimal: 0.15 },
    { maxAGI: 25500,  decimal: 0.14 },
    { maxAGI: 26000,  decimal: 0.13 },
    { maxAGI: 26500,  decimal: 0.12 },
    { maxAGI: 27000,  decimal: 0.11 },
    { maxAGI: 48000,  decimal: 0.10 },
    { maxAGI: 48500,  decimal: 0.09 },
    { maxAGI: 49000,  decimal: 0.08 },
    { maxAGI: 49500,  decimal: 0.07 },
    { maxAGI: 50000,  decimal: 0.06 },
    { maxAGI: 50500,  decimal: 0.05 },
    { maxAGI: 51000,  decimal: 0.04 },
    { maxAGI: 51500,  decimal: 0.03 },
    { maxAGI: 52000,  decimal: 0.02 },
    { maxAGI: 52500,  decimal: 0.01 },
    // > $52,500: 0.00
  ],
  head_of_household: [
    { maxAGI: 24000,  decimal: 0.75 },
    { maxAGI: 24500,  decimal: 0.70 },
    { maxAGI: 25000,  decimal: 0.65 },
    { maxAGI: 25500,  decimal: 0.60 },
    { maxAGI: 26000,  decimal: 0.55 },
    { maxAGI: 26500,  decimal: 0.50 },
    { maxAGI: 27000,  decimal: 0.45 },
    { maxAGI: 27500,  decimal: 0.40 },
    { maxAGI: 34000,  decimal: 0.35 },
    { maxAGI: 34500,  decimal: 0.30 },
    { maxAGI: 35000,  decimal: 0.25 },
    { maxAGI: 35500,  decimal: 0.20 },
    { maxAGI: 44000,  decimal: 0.15 },
    { maxAGI: 44500,  decimal: 0.14 },
    { maxAGI: 50000,  decimal: 0.13 },
    { maxAGI: 50500,  decimal: 0.12 },
    { maxAGI: 51000,  decimal: 0.11 },
    { maxAGI: 51500,  decimal: 0.10 },
    { maxAGI: 52000,  decimal: 0.09 },
    { maxAGI: 96000,  decimal: 0.08 },
    { maxAGI: 96500,  decimal: 0.07 },
    { maxAGI: 97000,  decimal: 0.06 },
    { maxAGI: 97500,  decimal: 0.05 },
    { maxAGI: 98000,  decimal: 0.04 },
    { maxAGI: 98500,  decimal: 0.03 },
    { maxAGI: 99000,  decimal: 0.02 },
    { maxAGI: 99500,  decimal: 0.01 },
    // > $99,500: 0.00
  ],
};

// ─── CT EITC ─────────────────────────────────────────────────────
// Connecticut EITC = 40% of federal EITC + $250/qualifying child (refundable)
// Source: 2025 CT-1040 instructions p.3
export const CT_EITC_MATCH_RATE = 0.40;
export const CT_EITC_CHILD_BONUS = 250;
