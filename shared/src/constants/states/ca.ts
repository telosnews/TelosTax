/**
 * California State Tax Constants — Tax Year 2025
 *
 * Sources:
 *   - CA Revenue & Taxation Code §17041 — California income tax rates
 *   - CA Revenue & Taxation Code §17043 — Mental Health Services Tax (Prop 63)
 *   - FTB Publication 1031 — Guidelines for Determining Resident Status
 *   - FTB Form 540 — California Resident Income Tax Return
 */

import { StateTaxBracket } from '../../types/index.js';

// ─── CA Income Tax Brackets (2025) ──────────────────────────────
// 9 progressive brackets per filing status

export const CA_BRACKETS: Record<string, StateTaxBracket[]> = {
  single: [
    { min: 0,       max: 11079,   rate: 0.01 },
    { min: 11079,   max: 26264,   rate: 0.02 },
    { min: 26264,   max: 41452,   rate: 0.04 },
    { min: 41452,   max: 57542,   rate: 0.06 },
    { min: 57542,   max: 72724,   rate: 0.08 },
    { min: 72724,   max: 371479,  rate: 0.093 },
    { min: 371479,  max: 445771,  rate: 0.103 },
    { min: 445771,  max: 742953,  rate: 0.113 },
    { min: 742953,  max: Infinity, rate: 0.123 },
  ],
  married_joint: [
    { min: 0,       max: 22158,   rate: 0.01 },
    { min: 22158,   max: 52528,   rate: 0.02 },
    { min: 52528,   max: 82904,   rate: 0.04 },
    { min: 82904,   max: 115084,  rate: 0.06 },
    { min: 115084,  max: 145448,  rate: 0.08 },
    { min: 145448,  max: 742958,  rate: 0.093 },
    { min: 742958,  max: 891542,  rate: 0.103 },
    { min: 891542,  max: 1485906, rate: 0.113 },
    { min: 1485906, max: Infinity, rate: 0.123 },
  ],
  married_separate: [
    { min: 0,       max: 11079,   rate: 0.01 },
    { min: 11079,   max: 26264,   rate: 0.02 },
    { min: 26264,   max: 41452,   rate: 0.04 },
    { min: 41452,   max: 57542,   rate: 0.06 },
    { min: 57542,   max: 72724,   rate: 0.08 },
    { min: 72724,   max: 371479,  rate: 0.093 },
    { min: 371479,  max: 445771,  rate: 0.103 },
    { min: 445771,  max: 742953,  rate: 0.113 },
    { min: 742953,  max: Infinity, rate: 0.123 },
  ],
  head_of_household: [
    { min: 0,       max: 22173,   rate: 0.01 },
    { min: 22173,   max: 52530,   rate: 0.02 },
    { min: 52530,   max: 67716,   rate: 0.04 },
    { min: 67716,   max: 83805,   rate: 0.06 },
    { min: 83805,   max: 98990,   rate: 0.08 },
    { min: 98990,   max: 505208,  rate: 0.093 },
    { min: 505208,  max: 606251,  rate: 0.103 },
    { min: 606251,  max: 1010417, rate: 0.113 },
    { min: 1010417, max: Infinity, rate: 0.123 },
  ],
};

// ─── CA Standard Deduction (2025) ───────────────────────────────
export const CA_STANDARD_DEDUCTION: Record<string, number> = {
  single: 5706,
  married_joint: 11412,
  married_separate: 5706,
  head_of_household: 11412,
};

// ─── CA Personal Exemption Credits (2025) ───────────────────────
// California uses exemption *credits* (reduce tax, not income)
export const CA_PERSONAL_EXEMPTION_CREDIT: Record<string, number> = {
  single: 153,
  married_joint: 306,        // $153 per spouse
  married_separate: 153,
  head_of_household: 153,    // 1 personal exemption (Form 540 Line 7, box 4 → enter 1)
};

export const CA_DEPENDENT_EXEMPTION_CREDIT = 475;  // Per dependent

// ─── Mental Health Services Tax (MHST) — Proposition 63 ────────
// Additional 1% on taxable income over $1,000,000
export const CA_MHST_THRESHOLD = 1000000;
export const CA_MHST_RATE = 0.01;

// ─── CA Depreciation Conformity (Schedule CA) ───────────────────
// CA does not conform to IRC §168(k) bonus depreciation.
// CA Section 179 limit is $25,000 (R&TC §17255) vs federal $1.25M.
// CA §179 investment threshold (begins phaseout): $200,000.
export const CA_SECTION_179_LIMIT = 25000;
export const CA_SECTION_179_THRESHOLD = 200000;

// ─── CA Itemized Deduction Limits ────────────────────────────────
// CA mortgage interest deduction limit (pre-TCJA $1M, not the federal $750K TCJA limit)
// MFS limit is half: $500K. R&TC §17220.
export const CA_MORTGAGE_LIMIT: Record<string, number> = {
  single: 1000000,
  married_joint: 1000000,
  married_separate: 500000,
  head_of_household: 1000000,
};

// ─── CA Itemized Deduction Limitation (Pease-Style Phase-Out) ────
// CA retains its own high-income itemized deduction limitation.
// Source: FTB Form 540 Instructions, Schedule CA (540) instructions
export const CA_ITEMIZED_DEDUCTION_LIMITATION_THRESHOLD: Record<string, number> = {
  single: 252203,
  married_joint: 504411,
  married_separate: 252203,
  head_of_household: 378310,
};
export const CA_ITEMIZED_LIMITATION_RATE = 0.06;           // 6% of AGI excess over threshold
export const CA_ITEMIZED_LIMITATION_MAX_REDUCTION = 0.80;  // Never remove more than 80% of subject deductions

// ─── CA Exemption Credit Phase-Out (AGI Limitation Worksheet) ────
// Source: FTB Form 540 Instructions, Line 32 (page 14)
// Reduces exemption credits by $6 per $2,500 ($1,250 MFS) of AGI excess.
// Uses the same AGI thresholds as the itemized deduction limitation.
export const CA_EXEMPTION_PHASEOUT_REDUCTION_PER_STEP = 6;    // $6 reduction per step
export const CA_EXEMPTION_PHASEOUT_STEP: Record<string, number> = {
  single: 2500,
  married_joint: 2500,
  married_separate: 1250,
  head_of_household: 2500,
};

// ─── CalEITC — Full Form 3514 Tables (2025) ─────────────────────
// Source: FTB Form 3514 Instructions, CalEITC tables
// Keyed by number of qualifying children (0, 1, 2, 3+)
export interface CalEITCEntry {
  phaseInRate: number;
  maxCredit: number;
  phaseOutStart: number;
  phaseOutRate: number;
  earnedIncomeLimit: number;
}
export const CA_EITC_TABLE: Record<number, CalEITCEntry> = {
  0: { phaseInRate: 0.0765, maxCredit: 302, phaseOutStart: 4661, phaseOutRate: 0.0765, earnedIncomeLimit: 8608 },
  1: { phaseInRate: 0.34,   maxCredit: 2016, phaseOutStart: 6998, phaseOutRate: 0.2171, earnedIncomeLimit: 16283 },
  2: { phaseInRate: 0.40,   maxCredit: 3339, phaseOutStart: 9823, phaseOutRate: 0.2171, earnedIncomeLimit: 25205 },
  3: { phaseInRate: 0.45,   maxCredit: 3756, phaseOutStart: 9823, phaseOutRate: 0.2171, earnedIncomeLimit: 27125 },
};
export const CA_EITC_INVESTMENT_INCOME_LIMIT = 4814;

// ─── Young Child Tax Credit (YCTC) — Form 3514 Part IV ──────────
// Source: FTB Form 3514 Instructions, YCTC section
export const CA_YCTC_AMOUNT_PER_CHILD = 1189;
export const CA_YCTC_PHASE_OUT_START: Record<string, number> = {
  single: 27425,
  married_joint: 27425,
  married_separate: 13713,
  head_of_household: 27425,
};
export const CA_YCTC_PHASE_OUT_RATE = 0.2171; // $21.71 reduction per $100 over threshold

// ─── CA Renter's Credit ──────────────────────────────────────────
// Source: FTB Form 540 Instructions, Line 46
// Nonrefundable credit for qualifying renters with CA AGI below threshold.
export const CA_RENTERS_CREDIT: Record<string, { credit: number; agiLimit: number }> = {
  single: { credit: 60, agiLimit: 53994 },
  married_joint: { credit: 120, agiLimit: 107988 },
  married_separate: { credit: 60, agiLimit: 53994 },
  head_of_household: { credit: 120, agiLimit: 107988 },
};

// ─── CA Dependent Care Credit (Form 3506) ────────────────────────
// Source: FTB Form 3506 Instructions
// CA has its own dependent care credit separate from federal.
// Rates keyed by CA AGI range.
export const CA_DEPENDENT_CARE_TABLE: { maxAGI: number; rate: number }[] = [
  { maxAGI: 40000,  rate: 0.50 },
  { maxAGI: 70000,  rate: 0.43 },
  { maxAGI: 100000, rate: 0.34 },
  // Over $100K → 0% (no credit)
];
export const CA_DEPENDENT_CARE_EXPENSE_LIMIT_1 = 3000;  // 1 qualifying person
export const CA_DEPENDENT_CARE_EXPENSE_LIMIT_2 = 6000;  // 2+ qualifying persons

// ─── CA Senior Head of Household Credit ──────────────────────────
// Nonrefundable credit for HoH filers aged 65+ with CA AGI below threshold.
// Source: FTB Form 540 Instructions
export const CA_SENIOR_HOH_CREDIT = 1860;
export const CA_SENIOR_HOH_CREDIT_RATE = 0.02;  // 2% of taxable income, capped at $1,860
export const CA_SENIOR_HOH_AGI_LIMIT = 98652;
export const CA_SENIOR_HOH_MIN_AGE = 65;

// ─── CA Dependent Parent Credit ──────────────────────────────────
// $475 per dependent with relationship === 'parent'. Nonrefundable.
export const CA_DEPENDENT_PARENT_CREDIT = 475;

// ─── CA SDI (State Disability Insurance) ────────────────────────
// Note: CA SDI is a payroll tax, not an income tax. It is withheld
// by employers and does not appear on the CA 540 return.
// Rate: 1.1% (2025) on all wages (no wage cap as of 2024+).
// Included here for reference/informational purposes only.
export const CA_SDI_RATE = 0.011;
