/**
 * Progressive-Tax State Constants — Tax Year 2025
 *
 * Configuration for all states that use the progressive bracket factory.
 * Each state's brackets, deductions, and exemptions are sourced from
 * official state DOR publications for TY2025.
 *
 * States included (20):
 *   VA, MN, OR, MO, SC, MS, KS, OK, AR, ID,
 *   ND, RI, WV, ME, NM, MT, NE, VT, DE, DC
 *
 * Rate Sources:
 *   VA:  Va. Code §58.1-320 (2025) — 4 brackets, top 5.75%
 *   MN:  Minn. Stat. §290.06 (2025) — 4 brackets, top 9.85%
 *   OR:  ORS §316.037 (2025) — 4 brackets, top 9.9%; $256 exemption credit (ORS §316.085)
 *   MO:  Mo. Rev. Stat. §143.011 (2025) — 5 brackets, top 4.7%
 *   SC:  S.C. Code §12-6-510 (2025) — 3 brackets, top 6.2%
 *   MS:  Miss. Code §27-7-5 (2025) — 2 brackets (zero + 4.4%)
 *   KS:  K.S.A. §79-32,110 (2025) — 2 brackets (5.2%/5.58%)
 *   OK:  68 O.S. §2355 (2025) — 6 brackets, top 4.75%
 *   AR:  Ark. Code §26-51-201 (2025) — 5 brackets, top 3.9%
 *   ID:  Idaho Code §63-3024 (2025) — 2 brackets (zero + 5.3%)
 *   ND:  N.D.C.C. §57-38-30.3 (2025) — 3 brackets, top 2.5%
 *   RI:  R.I.G.L. §44-30-2.6 (2025) — 3 brackets, top 5.99%
 *   WV:  W. Va. Code §11-21-4e (2025) — 5 brackets, top 4.82%
 *   ME:  36 M.R.S.A. §5111 (2025) — 3 brackets, top 7.15%
 *   NM:  N.M. Stat. §7-2-7 (2025) — 6 brackets, top 5.9%
 *   MT:  Mont. Code §15-30-2103 (2025) — 2 brackets, top 5.9%
 *   NE:  Neb. Rev. Stat. §77-2715.03 (2025) — 4 brackets, top 5.2%
 *   VT:  32 V.S.A. §5822 (2025) — 4 brackets, top 8.75%
 *   DE:  30 Del. C. §1102 (2025) — 7 brackets, top 6.6%
 *   DC:  D.C. Code §47-1806.03 (2025) — 7 brackets, top 10.75%
 */

import type { ProgressiveTaxStateConfig } from '../../engine/state/progressiveTax.js';
import { countExemptions } from '../../engine/state/progressiveTax.js';
import { type TaxReturn, type CalculationResult, type StateReturnConfig, FilingStatus } from '../../types/index.js';

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Same brackets for all filing statuses. */
function uniformBrackets(brackets: { min: number; max: number; rate: number }[]) {
  return {
    single: brackets,
    married_joint: brackets,
    married_separate: brackets,
    head_of_household: brackets,
  } as const;
}

/** Same deduction for all filing statuses. */
function uniformDeduction(amount: number) {
  return {
    single: amount,
    married_joint: amount,
    married_separate: amount,
    head_of_household: amount,
  } as const;
}

/**
 * Create a per-exemption credit hook (e.g., $171/person for NE, $29 for AR, $110 for DE).
 * Uses `countExemptions()` to count taxpayer + spouse (if MFJ/QSS) + dependents.
 */
function perExemptionCredit(amountPerExemption: number) {
  return (_tr: TaxReturn, _fed: CalculationResult, _prelim: {
    stateAGI: number; taxableIncome: number; baseTax: number;
  }, _cfg: StateReturnConfig) => {
    const count = countExemptions(_tr);
    return { credits: count * amountPerExemption };
  };
}

// ═══════════════════════════════════════════════════════════════════
// VIRGINIA — 4 brackets, top 5.75%
// Va. Code §58.1-320. Same brackets all statuses.
// $930 personal exemption, $930 dependent exemption.
// ═══════════════════════════════════════════════════════════════════

export const VA_CONFIG: ProgressiveTaxStateConfig = {
  stateCode: 'VA',
  startingPoint: 'federal_agi',
  brackets: uniformBrackets([
    { min: 0, max: 3000, rate: 0.02 },
    { min: 3000, max: 5000, rate: 0.03 },
    { min: 5000, max: 17000, rate: 0.05 },
    { min: 17000, max: Infinity, rate: 0.0575 },
  ]),
  standardDeduction: {
    single: 8750,
    married_joint: 17500,
    married_separate: 8750,
    head_of_household: 8750,
  },
  personalExemption: 930,
  dependentExemption: 930,
  stateEITCRate: 0.20,
  stateEITCRefundable: true,
};

// ═══════════════════════════════════════════════════════════════════
// MINNESOTA — 4 brackets, top 9.85%
// Minn. Stat. §290.06. Filing-status-specific brackets.
// No personal exemption (uses dependent exemption only).
// ═══════════════════════════════════════════════════════════════════

export const MN_CONFIG: ProgressiveTaxStateConfig = {
  stateCode: 'MN',
  startingPoint: 'federal_taxable_income',
  brackets: {
    single: [
      { min: 0, max: 32570, rate: 0.0535 },
      { min: 32570, max: 106990, rate: 0.068 },
      { min: 106990, max: 198630, rate: 0.0785 },
      { min: 198630, max: Infinity, rate: 0.0985 },
    ],
    married_joint: [
      { min: 0, max: 47620, rate: 0.0535 },
      { min: 47620, max: 189180, rate: 0.068 },
      { min: 189180, max: 330410, rate: 0.0785 },
      { min: 330410, max: Infinity, rate: 0.0985 },
    ],
    married_separate: [
      { min: 0, max: 23810, rate: 0.0535 },
      { min: 23810, max: 94590, rate: 0.068 },
      { min: 94590, max: 165205, rate: 0.0785 },
      { min: 165205, max: Infinity, rate: 0.0985 },
    ],
    head_of_household: [
      { min: 0, max: 39850, rate: 0.0535 },
      { min: 39850, max: 160230, rate: 0.068 },
      { min: 160230, max: 272850, rate: 0.0785 },
      { min: 272850, max: Infinity, rate: 0.0985 },
    ],
  },
  standardDeduction: { single: 0, married_joint: 0, married_separate: 0, head_of_household: 0 },
  personalExemption: 0,
  dependentExemption: 5200,
  stateEITCRate: 0.45,
  stateEITCRefundable: true,
};

// ═══════════════════════════════════════════════════════════════════
// OREGON — 4 brackets, top 9.9%
// ORS §316.037. Starts from federal taxable income.
// $256 personal credit per exemption (ORS §316.085 — credit, not deduction).
// Filing-status-specific brackets.
// ═══════════════════════════════════════════════════════════════════

export const OR_CONFIG: ProgressiveTaxStateConfig = {
  stateCode: 'OR',
  startingPoint: 'federal_taxable_income',
  brackets: {
    single: [
      { min: 0, max: 4400, rate: 0.0475 },
      { min: 4400, max: 11050, rate: 0.0675 },
      { min: 11050, max: 125000, rate: 0.0875 },
      { min: 125000, max: Infinity, rate: 0.099 },
    ],
    married_joint: [
      { min: 0, max: 8800, rate: 0.0475 },
      { min: 8800, max: 22200, rate: 0.0675 },
      { min: 22200, max: 250000, rate: 0.0875 },
      { min: 250000, max: Infinity, rate: 0.099 },
    ],
    married_separate: [
      { min: 0, max: 4400, rate: 0.0475 },
      { min: 4400, max: 11050, rate: 0.0675 },
      { min: 11050, max: 125000, rate: 0.0875 },
      { min: 125000, max: Infinity, rate: 0.099 },
    ],
    head_of_household: [
      { min: 0, max: 8800, rate: 0.0475 },
      { min: 8800, max: 22200, rate: 0.0675 },
      { min: 22200, max: 250000, rate: 0.0875 },
      { min: 250000, max: Infinity, rate: 0.099 },
    ],
  },
  standardDeduction: {
    single: 2835,
    married_joint: 5670,
    married_separate: 2835,
    head_of_household: 4560,
  },
  personalExemption: 0,
  dependentExemption: 0,
  stateEITCRate: 0.09, // 9% default; 12% only if qualifying child is under age 3 (ORS §315.266)
  stateEITCRefundable: true,
  hooks: {
    // OR personal exemption credit: $256 per exemption — ORS §316.085 (credit, not deduction)
    // Source: OR-40 instructions p.18
    credits: perExemptionCredit(256),
  },
};

// ═══════════════════════════════════════════════════════════════════
// MISSOURI — 7 brackets, top 4.7%
// Mo. Rev. Stat. §143.011 (2025). Same brackets all statuses.
// Top bracket starts at $9,191.
// ═══════════════════════════════════════════════════════════════════

export const MO_CONFIG: ProgressiveTaxStateConfig = {
  stateCode: 'MO',
  startingPoint: 'federal_agi',
  brackets: uniformBrackets([
    { min: 0, max: 1313, rate: 0.02 },
    { min: 1313, max: 2626, rate: 0.025 },
    { min: 2626, max: 3939, rate: 0.03 },
    { min: 3939, max: 5252, rate: 0.035 },
    { min: 5252, max: 6565, rate: 0.04 },
    { min: 6565, max: 7878, rate: 0.045 },
    { min: 7878, max: Infinity, rate: 0.047 },
  ]),
  standardDeduction: {
    single: 14600,
    married_joint: 29200,
    married_separate: 14600,
    head_of_household: 21900,
  },
  personalExemption: 0,
  dependentExemption: 1200,
  stateEITCRate: 0.20, // Increased from 10% to 20% for TY2025 — 2025 MO-1040 instructions p.10
  stateEITCRefundable: false,
};

// ═══════════════════════════════════════════════════════════════════
// SOUTH CAROLINA — 3 brackets (zero + 2 rates), top 6.2%
// S.C. Code §12-6-510 (2025).
// ═══════════════════════════════════════════════════════════════════

export const SC_CONFIG: ProgressiveTaxStateConfig = {
  stateCode: 'SC',
  startingPoint: 'federal_taxable_income',
  brackets: uniformBrackets([
    { min: 0, max: 3560, rate: 0.00 },
    { min: 3560, max: 17830, rate: 0.03 },
    { min: 17830, max: Infinity, rate: 0.062 },
  ]),
  standardDeduction: { single: 0, married_joint: 0, married_separate: 0, head_of_household: 0 },
  personalExemption: 0,
  dependentExemption: 0,
  stateEITCRate: 0.1042,
  stateEITCRefundable: false,
};

// ═══════════════════════════════════════════════════════════════════
// MISSISSIPPI — 2 brackets (zero + 4.4%)
// Miss. Code §27-7-5 (2025). $10,000 zero bracket.
// ═══════════════════════════════════════════════════════════════════

export const MS_CONFIG: ProgressiveTaxStateConfig = {
  stateCode: 'MS',
  startingPoint: 'federal_agi',
  brackets: uniformBrackets([
    { min: 0, max: 10000, rate: 0.00 },
    { min: 10000, max: Infinity, rate: 0.044 },
  ]),
  standardDeduction: {
    single: 2300,
    married_joint: 4600,
    married_separate: 2300,
    head_of_household: 3400,
  },
  personalExemption: {
    single: 6000,
    married_joint: 12000,
    married_separate: 6000,
    head_of_household: 8000,
  },
  dependentExemption: 1500,
};

// ═══════════════════════════════════════════════════════════════════
// KANSAS — 2 brackets (5.2%/5.58%)
// K.S.A. §79-32,110 (2025). $9,160 personal exemption per person.
// ═══════════════════════════════════════════════════════════════════

export const KS_CONFIG: ProgressiveTaxStateConfig = {
  stateCode: 'KS',
  startingPoint: 'federal_agi',
  brackets: {
    single: [
      { min: 0, max: 23000, rate: 0.052 },
      { min: 23000, max: Infinity, rate: 0.0558 },
    ],
    married_joint: [
      { min: 0, max: 46000, rate: 0.052 },
      { min: 46000, max: Infinity, rate: 0.0558 },
    ],
    married_separate: [
      { min: 0, max: 23000, rate: 0.052 },
      { min: 23000, max: Infinity, rate: 0.0558 },
    ],
    head_of_household: [
      { min: 0, max: 23000, rate: 0.052 },
      { min: 23000, max: Infinity, rate: 0.0558 },
    ],
  },
  standardDeduction: {
    single: 3605,
    married_joint: 8240,
    married_separate: 4120,
    head_of_household: 6170,
  },
  personalExemption: 9160,
  dependentExemption: 2320,
  stateEITCRate: 0.17,
  stateEITCRefundable: true,
};

// ═══════════════════════════════════════════════════════════════════
// OKLAHOMA — 6 brackets, top 4.75%
// 68 O.S. §2355 (2025). Filing-status-specific brackets.
// $1,000 personal exemption per person.
// ═══════════════════════════════════════════════════════════════════

export const OK_CONFIG: ProgressiveTaxStateConfig = {
  stateCode: 'OK',
  startingPoint: 'federal_agi',
  brackets: {
    single: [
      { min: 0, max: 1000, rate: 0.0025 },
      { min: 1000, max: 2500, rate: 0.0075 },
      { min: 2500, max: 3750, rate: 0.0175 },
      { min: 3750, max: 4900, rate: 0.0275 },
      { min: 4900, max: 7200, rate: 0.0375 },
      { min: 7200, max: Infinity, rate: 0.0475 },
    ],
    married_joint: [
      { min: 0, max: 2000, rate: 0.0025 },
      { min: 2000, max: 5000, rate: 0.0075 },
      { min: 5000, max: 7500, rate: 0.0175 },
      { min: 7500, max: 9800, rate: 0.0275 },
      { min: 9800, max: 14400, rate: 0.0375 },
      { min: 14400, max: Infinity, rate: 0.0475 },
    ],
    married_separate: [
      { min: 0, max: 1000, rate: 0.0025 },
      { min: 1000, max: 2500, rate: 0.0075 },
      { min: 2500, max: 3750, rate: 0.0175 },
      { min: 3750, max: 4900, rate: 0.0275 },
      { min: 4900, max: 7200, rate: 0.0375 },
      { min: 7200, max: Infinity, rate: 0.0475 },
    ],
    head_of_household: [
      { min: 0, max: 2000, rate: 0.0025 },
      { min: 2000, max: 5000, rate: 0.0075 },
      { min: 5000, max: 7500, rate: 0.0175 },
      { min: 7500, max: 9800, rate: 0.0275 },
      { min: 9800, max: 14400, rate: 0.0375 },
      { min: 14400, max: Infinity, rate: 0.0475 },
    ],
  },
  standardDeduction: {
    single: 6350,
    married_joint: 12700,
    married_separate: 6350,
    head_of_household: 9550,
  },
  personalExemption: 1000,
  dependentExemption: 1000,
  stateEITCRate: 0.05,
  stateEITCRefundable: true,
};

// ═══════════════════════════════════════════════════════════════════
// ARKANSAS — 5 brackets, top 3.9%
// Ark. Code §26-51-201 (2025). Same brackets all statuses.
// Source: 2025 AR1000F instructions p.26
// ═══════════════════════════════════════════════════════════════════

export const AR_CONFIG: ProgressiveTaxStateConfig = {
  stateCode: 'AR',
  startingPoint: 'federal_agi',
  brackets: uniformBrackets([
    { min: 0, max: 5600, rate: 0.00 },
    { min: 5600, max: 11200, rate: 0.02 },
    { min: 11200, max: 16000, rate: 0.03 },
    { min: 16000, max: 26400, rate: 0.034 },
    { min: 26400, max: Infinity, rate: 0.039 },
  ]),
  standardDeduction: {
    single: 2410,
    married_joint: 4820,
    married_separate: 2410,
    head_of_household: 2410,
  },
  personalExemption: 0,
  dependentExemption: 0,
  stateEITCRate: 0.20,
  stateEITCRefundable: false,
  hooks: {
    // AR exemption credit: $29 per exemption — Ark. Code §26-51-501 (tax credit, not deduction)
    credits: perExemptionCredit(29),
  },
};

// ═══════════════════════════════════════════════════════════════════
// IDAHO — 2 brackets (zero + 5.3%)
// Idaho Code §63-3024 (2025). NOT a flat tax — has zero bracket.
// ═══════════════════════════════════════════════════════════════════

export const ID_CONFIG: ProgressiveTaxStateConfig = {
  stateCode: 'ID',
  startingPoint: 'federal_taxable_income',
  brackets: {
    single: [
      { min: 0, max: 4811, rate: 0.00 },
      { min: 4811, max: Infinity, rate: 0.053 },
    ],
    married_joint: [
      { min: 0, max: 9622, rate: 0.00 },
      { min: 9622, max: Infinity, rate: 0.053 },
    ],
    married_separate: [
      { min: 0, max: 4811, rate: 0.00 },
      { min: 4811, max: Infinity, rate: 0.053 },
    ],
    head_of_household: [
      { min: 0, max: 4811, rate: 0.00 },
      { min: 4811, max: Infinity, rate: 0.053 },
    ],
  },
  standardDeduction: { single: 0, married_joint: 0, married_separate: 0, head_of_household: 0 },
  personalExemption: 0,
  dependentExemption: 0,
};

// ═══════════════════════════════════════════════════════════════════
// NORTH DAKOTA — 3 brackets, top 2.5%
// N.D.C.C. §57-38-30.3 (2025). Very low rates.
// ═══════════════════════════════════════════════════════════════════

export const ND_CONFIG: ProgressiveTaxStateConfig = {
  stateCode: 'ND',
  startingPoint: 'federal_taxable_income',
  brackets: {
    single: [
      { min: 0, max: 48475, rate: 0.00 },
      { min: 48475, max: 244825, rate: 0.0195 },
      { min: 244825, max: Infinity, rate: 0.025 },
    ],
    married_joint: [
      { min: 0, max: 80975, rate: 0.00 },
      { min: 80975, max: 298075, rate: 0.0195 },
      { min: 298075, max: Infinity, rate: 0.025 },
    ],
    married_separate: [
      { min: 0, max: 40488, rate: 0.00 },
      { min: 40488, max: 149038, rate: 0.0195 },
      { min: 149038, max: Infinity, rate: 0.025 },
    ],
    head_of_household: [
      { min: 0, max: 64950, rate: 0.00 },
      { min: 64950, max: 271450, rate: 0.0195 },
      { min: 271450, max: Infinity, rate: 0.025 },
    ],
  },
  standardDeduction: { single: 0, married_joint: 0, married_separate: 0, head_of_household: 0 },
  personalExemption: 0,
  dependentExemption: 0,
};

// ═══════════════════════════════════════════════════════════════════
// RHODE ISLAND — 3 brackets, top 5.99%
// R.I.G.L. §44-30-2.6 (2025). Same brackets all statuses.
// ═══════════════════════════════════════════════════════════════════

export const RI_CONFIG: ProgressiveTaxStateConfig = {
  stateCode: 'RI',
  startingPoint: 'federal_agi',
  brackets: uniformBrackets([
    { min: 0, max: 79900, rate: 0.0375 },
    { min: 79900, max: 181650, rate: 0.0475 },
    { min: 181650, max: Infinity, rate: 0.0599 },
  ]),
  standardDeduction: {
    single: 10900,
    married_joint: 21800,
    married_separate: 10900,
    head_of_household: 16350,
  },
  personalExemption: 5100,
  dependentExemption: 5100,
  stateEITCRate: 0.15,
  stateEITCRefundable: true,
};

// ═══════════════════════════════════════════════════════════════════
// WEST VIRGINIA — 5 brackets, top 4.82%
// W. Va. Code §11-21-4e (2025). Same brackets all statuses.
// ═══════════════════════════════════════════════════════════════════

export const WV_CONFIG: ProgressiveTaxStateConfig = {
  stateCode: 'WV',
  startingPoint: 'federal_agi',
  brackets: uniformBrackets([
    { min: 0, max: 10000, rate: 0.0222 },
    { min: 10000, max: 25000, rate: 0.0296 },
    { min: 25000, max: 40000, rate: 0.0333 },
    { min: 40000, max: 60000, rate: 0.0444 },
    { min: 60000, max: Infinity, rate: 0.0482 },
  ]),
  standardDeduction: { single: 0, married_joint: 0, married_separate: 0, head_of_household: 0 },
  personalExemption: 2000,
  dependentExemption: 2000,
};

// ═══════════════════════════════════════════════════════════════════
// MAINE — 3 brackets, top 7.15%
// 36 M.R.S.A. §5111 (2025). Filing-status-specific brackets.
// $5,150 personal exemption per person.
// ═══════════════════════════════════════════════════════════════════

export const ME_CONFIG: ProgressiveTaxStateConfig = {
  stateCode: 'ME',
  startingPoint: 'federal_agi',
  brackets: {
    single: [
      { min: 0, max: 26800, rate: 0.058 },
      { min: 26800, max: 63450, rate: 0.0675 },
      { min: 63450, max: Infinity, rate: 0.0715 },
    ],
    married_joint: [
      { min: 0, max: 53600, rate: 0.058 },
      { min: 53600, max: 126900, rate: 0.0675 },
      { min: 126900, max: Infinity, rate: 0.0715 },
    ],
    married_separate: [
      { min: 0, max: 26800, rate: 0.058 },
      { min: 26800, max: 63450, rate: 0.0675 },
      { min: 63450, max: Infinity, rate: 0.0715 },
    ],
    head_of_household: [
      { min: 0, max: 40200, rate: 0.058 },
      { min: 40200, max: 95150, rate: 0.0675 },
      { min: 95200, max: Infinity, rate: 0.0715 },
    ],
  },
  standardDeduction: {
    single: 14600,
    married_joint: 29200,
    married_separate: 14600,
    head_of_household: 21900,
  },
  personalExemption: 5150,
  dependentExemption: 5150,
  // ME EITC: 25% with qualifying children, 50% without — 2025 ME 1040ME instructions p.10
  hooks: {
    credits: (tr: TaxReturn, fed: CalculationResult, _prelim: {
      stateAGI: number; taxableIncome: number; baseTax: number;
    }, _cfg: StateReturnConfig) => {
      const federalEITC = fed.credits.eitcCredit || 0;
      if (federalEITC <= 0) return { credits: 0 };
      const qualifyingChildren = (tr.dependents || []).length;
      const rate = qualifyingChildren > 0 ? 0.25 : 0.50;
      return { credits: Math.round(federalEITC * rate) };
    },
  },
};

// ═══════════════════════════════════════════════════════════════════
// NEW MEXICO — 5 brackets, top 5.9%
// N.M. Stat. §7-2-7 (2025). Federal std ded conformity.
// ═══════════════════════════════════════════════════════════════════

export const NM_CONFIG: ProgressiveTaxStateConfig = {
  stateCode: 'NM',
  startingPoint: 'federal_agi',
  brackets: {
    single: [
      { min: 0, max: 5500, rate: 0.015 },
      { min: 5500, max: 16500, rate: 0.032 },
      { min: 16500, max: 33500, rate: 0.043 },
      { min: 33500, max: 66500, rate: 0.047 },
      { min: 66500, max: 210000, rate: 0.049 },
      { min: 210000, max: Infinity, rate: 0.059 },
    ],
    married_joint: [
      { min: 0, max: 8000, rate: 0.015 },
      { min: 8000, max: 25000, rate: 0.032 },
      { min: 25000, max: 50000, rate: 0.043 },
      { min: 50000, max: 100000, rate: 0.047 },
      { min: 100000, max: 315000, rate: 0.049 },
      { min: 315000, max: Infinity, rate: 0.059 },
    ],
    married_separate: [
      { min: 0, max: 4000, rate: 0.015 },
      { min: 4000, max: 12500, rate: 0.032 },
      { min: 12500, max: 25000, rate: 0.043 },
      { min: 25000, max: 50000, rate: 0.047 },
      { min: 50000, max: 157500, rate: 0.049 },
      { min: 157500, max: Infinity, rate: 0.059 },
    ],
    head_of_household: [
      { min: 0, max: 8000, rate: 0.015 },
      { min: 8000, max: 25000, rate: 0.032 },
      { min: 25000, max: 50000, rate: 0.043 },
      { min: 50000, max: 100000, rate: 0.047 },
      { min: 100000, max: 315000, rate: 0.049 },
      { min: 315000, max: Infinity, rate: 0.059 },
    ],
  },
  standardDeduction: {
    single: 14600,
    married_joint: 29200,
    married_separate: 14600,
    head_of_household: 21900,
  },
  personalExemption: 0,
  dependentExemption: 4000,
  stateEITCRate: 0.25,
  stateEITCRefundable: true,
};

// ═══════════════════════════════════════════════════════════════════
// MONTANA — 2 brackets, top 5.9%
// Mont. Code §15-30-2103 (2025). Starts from federal taxable income.
// ═══════════════════════════════════════════════════════════════════

export const MT_CONFIG: ProgressiveTaxStateConfig = {
  stateCode: 'MT',
  startingPoint: 'federal_taxable_income',
  brackets: {
    single: [
      { min: 0, max: 21100, rate: 0.047 },
      { min: 21100, max: Infinity, rate: 0.059 },
    ],
    married_joint: [
      { min: 0, max: 42200, rate: 0.047 },
      { min: 42200, max: Infinity, rate: 0.059 },
    ],
    married_separate: [
      { min: 0, max: 21100, rate: 0.047 },
      { min: 21100, max: Infinity, rate: 0.059 },
    ],
    head_of_household: [
      { min: 0, max: 31700, rate: 0.047 },
      { min: 31700, max: Infinity, rate: 0.059 },
    ],
  },
  standardDeduction: { single: 0, married_joint: 0, married_separate: 0, head_of_household: 0 },
  personalExemption: 0,
  dependentExemption: 0,
};

// ═══════════════════════════════════════════════════════════════════
// NEBRASKA — 4 brackets, top 5.2%
// Neb. Rev. Stat. §77-2715.03 (2025).
// NE uses exemption credits ($171 per exemption) rather than deductions.
// ═══════════════════════════════════════════════════════════════════

export const NE_CONFIG: ProgressiveTaxStateConfig = {
  stateCode: 'NE',
  startingPoint: 'federal_agi',
  brackets: {
    single: [
      { min: 0, max: 4030, rate: 0.0246 },
      { min: 4030, max: 24120, rate: 0.0351 },
      { min: 24120, max: 38870, rate: 0.0501 },
      { min: 38870, max: Infinity, rate: 0.052 },
    ],
    married_joint: [
      { min: 0, max: 8040, rate: 0.0246 },
      { min: 8040, max: 48250, rate: 0.0351 },
      { min: 48250, max: 77730, rate: 0.0501 },
      { min: 77730, max: Infinity, rate: 0.052 },
    ],
    married_separate: [
      { min: 0, max: 4030, rate: 0.0246 },
      { min: 4030, max: 24120, rate: 0.0351 },
      { min: 24120, max: 38870, rate: 0.0501 },
      { min: 38870, max: Infinity, rate: 0.052 },
    ],
    head_of_household: [
      { min: 0, max: 7510, rate: 0.0246 },
      { min: 7510, max: 38590, rate: 0.0351 },
      { min: 38590, max: 57630, rate: 0.0501 },
      { min: 57630, max: Infinity, rate: 0.052 },
    ],
  },
  standardDeduction: {
    single: 8600,
    married_joint: 17200,
    married_separate: 8600,
    head_of_household: 12580,
  },
  personalExemption: 0,
  dependentExemption: 0,
  stateEITCRate: 0.10,
  stateEITCRefundable: true,
  hooks: {
    // NE exemption credit: $171 per exemption — Neb. Rev. Stat. §77-2716.01 (credit, not deduction)
    credits: perExemptionCredit(171),
  },
};

// ═══════════════════════════════════════════════════════════════════
// VERMONT — 4 brackets, top 8.75%
// 32 V.S.A. §5822 (2025). Standard progressive.
// ═══════════════════════════════════════════════════════════════════

export const VT_CONFIG: ProgressiveTaxStateConfig = {
  stateCode: 'VT',
  startingPoint: 'federal_taxable_income',
  brackets: {
    single: [
      { min: 0, max: 47900, rate: 0.0335 },
      { min: 47900, max: 116000, rate: 0.066 },
      { min: 116000, max: 242000, rate: 0.076 },
      { min: 242000, max: Infinity, rate: 0.0875 },
    ],
    married_joint: [
      { min: 0, max: 79950, rate: 0.0335 },
      { min: 79950, max: 193300, rate: 0.066 },
      { min: 193300, max: 294600, rate: 0.076 },
      { min: 294600, max: Infinity, rate: 0.0875 },
    ],
    married_separate: [
      { min: 0, max: 39975, rate: 0.0335 },
      { min: 39975, max: 96650, rate: 0.066 },
      { min: 96650, max: 147300, rate: 0.076 },
      { min: 147300, max: Infinity, rate: 0.0875 },
    ],
    head_of_household: [
      { min: 0, max: 64100, rate: 0.0335 },
      { min: 64100, max: 154850, rate: 0.066 },
      { min: 154850, max: 268250, rate: 0.076 },
      { min: 268250, max: Infinity, rate: 0.0875 },
    ],
  },
  standardDeduction: {
    single: 7650,
    married_joint: 15300,
    married_separate: 7650,
    head_of_household: 11450,
  },
  personalExemption: 5300, // 2025 VT IN-111 form + Income Booklet p.11
  dependentExemption: 5300,
  stateEITCRate: 0.38,
  stateEITCRefundable: true,
};

// ═══════════════════════════════════════════════════════════════════
// DELAWARE — 7 brackets, top 6.6%
// 30 Del. C. §1102 (2025). Same brackets all statuses.
// $110 personal exemption credit, $110 dependent credit.
// Pension exclusion: $12,500 for age 60+.
// ═══════════════════════════════════════════════════════════════════

export const DE_CONFIG: ProgressiveTaxStateConfig = {
  stateCode: 'DE',
  startingPoint: 'federal_agi',
  brackets: uniformBrackets([
    { min: 0, max: 2000, rate: 0.00 },
    { min: 2000, max: 5000, rate: 0.022 },
    { min: 5000, max: 10000, rate: 0.039 },
    { min: 10000, max: 20000, rate: 0.048 },
    { min: 20000, max: 25000, rate: 0.052 },
    { min: 25000, max: 60000, rate: 0.0555 },
    { min: 60000, max: Infinity, rate: 0.066 },
  ]),
  standardDeduction: {
    single: 3250,
    married_joint: 6500,
    married_separate: 3250,
    head_of_household: 3250,
  },
  personalExemption: 0,
  dependentExemption: 0,
  hooks: {
    subtractions: (tr: TaxReturn, fed: CalculationResult, _cfg: StateReturnConfig) => {
      let subs = 0;
      // Delaware pension exclusion: up to $12,500 for age 60+
      const pensionIncome = (tr.income1099R || []).reduce(
        (sum, r) => sum + (r.taxableAmount || 0), 0,
      );
      if (pensionIncome > 0 && tr.dateOfBirth) {
        const year = parseInt(tr.dateOfBirth.substring(0, 4), 10);
        if (!isNaN(year) && (2025 - year) >= 60) {
          subs += Math.min(pensionIncome, 12500);
        }
      }
      return subs;
    },
    // DE personal exemption credit: $110 per exemption — 30 Del. C. §1102 (credit, not deduction)
    // DE EITC: taxpayer picks ONE of two options (whichever is more beneficial):
    //   Option A: 4.5% of federal EITC (refundable — excess refunded)
    //   Option B: 20% of federal EITC (non-refundable — capped at remaining tax)
    // Source: 2025 DE PIT instructions p.10 (confirmed by official PDF)
    credits: (tr: TaxReturn, fed: CalculationResult, prelim: {
      stateAGI: number; taxableIncome: number; baseTax: number;
    }, cfg: StateReturnConfig) => {
      const count = countExemptions(tr);
      const exemptionCredit = count * 110;
      const federalEITC = fed.credits.eitcCredit || 0;
      const remainingTax = Math.max(0, prelim.baseTax - exemptionCredit);

      if (federalEITC <= 0) {
        return { credits: exemptionCredit, taxAfterCredits: remainingTax, refundableExcess: 0 };
      }

      // Option A: 4.5% refundable (total benefit = full amount incl. refund)
      const refundableAmt = federalEITC * 0.045;
      // Option B: 20% non-refundable (total benefit capped at remaining tax)
      const nrAmt = Math.min(federalEITC * 0.20, remainingTax);

      if (refundableAmt >= nrAmt) {
        // Refundable option is better (low tax liability → get excess as refund)
        return {
          credits: exemptionCredit + refundableAmt,
          taxAfterCredits: Math.max(0, remainingTax - refundableAmt),
          refundableExcess: Math.max(0, refundableAmt - remainingTax),
        };
      } else {
        // Non-refundable option is better (high tax liability → 20% > 4.5%)
        return {
          credits: exemptionCredit + nrAmt,
          taxAfterCredits: remainingTax - nrAmt,
          refundableExcess: 0,
        };
      }
    },
  },
};

// ═══════════════════════════════════════════════════════════════════
// DISTRICT OF COLUMBIA — 7 brackets, top 10.75%
// D.C. Code §47-1806.03 (2025). High rates.
// ═══════════════════════════════════════════════════════════════════

export const DC_CONFIG: ProgressiveTaxStateConfig = {
  stateCode: 'DC',
  startingPoint: 'federal_agi',
  brackets: uniformBrackets([
    { min: 0, max: 10000, rate: 0.04 },
    { min: 10000, max: 40000, rate: 0.06 },
    { min: 40000, max: 60000, rate: 0.065 },
    { min: 60000, max: 250000, rate: 0.085 },
    { min: 250000, max: 500000, rate: 0.0925 },
    { min: 500000, max: 1000000, rate: 0.0975 },
    { min: 1000000, max: Infinity, rate: 0.1075 },
  ]),
  standardDeduction: {
    single: 14600,
    married_joint: 29200,
    married_separate: 14600,
    head_of_household: 21900,
  },
  personalExemption: 0,
  dependentExemption: 0,
  // DC EITC: 100% of federal for filers with children; standalone calc for childless
  // Source: DC D-40 Booklet p.21, D.C. Code §47-1806.03(f)(1)(B-2)
  hooks: {
    credits: (tr: TaxReturn, fed: CalculationResult, prelim: {
      stateAGI: number; taxableIncome: number; baseTax: number;
    }, _cfg: StateReturnConfig) => {
      const federalEITC = fed.credits.eitcCredit || 0;
      if (federalEITC <= 0) {
        return { credits: 0 };
      }

      const childRelationships = ['child', 'stepchild', 'fosterchild', 'foster child', 'grandchild'];
      const childCount = (tr.dependents || []).filter(
        (d) => childRelationships.includes(d.relationship?.toLowerCase() || ''),
      ).length;
      const hasChildren = childCount > 0 || (tr.dependents?.length || 0) > 0;

      let dcEITC: number;
      if (hasChildren) {
        // With qualifying children: 100% of federal EITC
        dcEITC = federalEITC;
      } else {
        // Childless standalone calculation (D.C. Code §47-1806.03(f)(2))
        // Phase-in: 7.65% of earned income up to $649 max
        // Phaseout: 8.48% reduction starting at AGI $23,288, fully phased out at $30,941
        const earnedIncome = (fed.form1040.totalWages || 0) + (fed.form1040.scheduleCNetProfit || 0);
        const phaseInAmt = Math.min(649, Math.round(earnedIncome * 0.0765 * 100) / 100);
        const agi = prelim.stateAGI;
        if (agi > 23288) {
          const phaseoutReduction = Math.round((agi - 23288) * 0.0848 * 100) / 100;
          dcEITC = Math.max(0, phaseInAmt - phaseoutReduction);
        } else {
          dcEITC = phaseInAmt;
        }
      }

      // DC EITC is fully refundable
      const taxAfterCredits = Math.max(0, prelim.baseTax - dcEITC);
      const refundableExcess = Math.max(0, dcEITC - prelim.baseTax);
      return { credits: dcEITC, taxAfterCredits, refundableExcess };
    },
  },
};

// ═══════════════════════════════════════════════════════════════════
// ALL PROGRESSIVE STATE CONFIGS (for registry import)
// ═══════════════════════════════════════════════════════════════════

export const PROGRESSIVE_TAX_CONFIGS: Record<string, ProgressiveTaxStateConfig> = {
  VA: VA_CONFIG,
  MN: MN_CONFIG,
  OR: OR_CONFIG,
  MO: MO_CONFIG,
  SC: SC_CONFIG,
  MS: MS_CONFIG,
  KS: KS_CONFIG,
  OK: OK_CONFIG,
  AR: AR_CONFIG,
  ID: ID_CONFIG,
  ND: ND_CONFIG,
  RI: RI_CONFIG,
  WV: WV_CONFIG,
  ME: ME_CONFIG,
  NM: NM_CONFIG,
  MT: MT_CONFIG,
  NE: NE_CONFIG,
  VT: VT_CONFIG,
  DE: DE_CONFIG,
  DC: DC_CONFIG,
};
