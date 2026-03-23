/**
 * New Jersey State Tax Constants — Tax Year 2025
 *
 * Sources:
 *   - N.J.S.A. 54A:2-1 — New Jersey Gross Income Tax Act
 *   - NJ Division of Taxation — Tax Rate Schedules
 *   - NJ-1040 Instructions — Personal exemptions and deductions
 */

import { StateTaxBracket } from '../../types/index.js';

// ─── NJ Income Tax Brackets (2025) ──────────────────────────────
// Progressive rate schedule per filing status
// NJ uses different brackets for Single/MFS vs. MFJ/HoH

export const NJ_BRACKETS: Record<string, StateTaxBracket[]> = {
  single: [
    { min: 0,       max: 20000,   rate: 0.014 },
    { min: 20000,   max: 35000,   rate: 0.0175 },
    { min: 35000,   max: 40000,   rate: 0.035 },
    { min: 40000,   max: 75000,   rate: 0.05525 },
    { min: 75000,   max: 500000,  rate: 0.0637 },
    { min: 500000,  max: 1000000, rate: 0.0897 },
    { min: 1000000, max: Infinity, rate: 0.1075 },
  ],
  married_joint: [
    { min: 0,       max: 20000,   rate: 0.014 },
    { min: 20000,   max: 50000,   rate: 0.0175 },
    { min: 50000,   max: 70000,   rate: 0.0245 },
    { min: 70000,   max: 80000,   rate: 0.035 },
    { min: 80000,   max: 150000,  rate: 0.05525 },
    { min: 150000,  max: 500000,  rate: 0.0637 },
    { min: 500000,  max: 1000000, rate: 0.0897 },
    { min: 1000000, max: Infinity, rate: 0.1075 },
  ],
  married_separate: [
    { min: 0,       max: 20000,   rate: 0.014 },
    { min: 20000,   max: 35000,   rate: 0.0175 },
    { min: 35000,   max: 40000,   rate: 0.035 },
    { min: 40000,   max: 75000,   rate: 0.05525 },
    { min: 75000,   max: 500000,  rate: 0.0637 },
    { min: 500000,  max: 1000000, rate: 0.0897 },
    { min: 1000000, max: Infinity, rate: 0.1075 },
  ],
  head_of_household: [
    { min: 0,       max: 20000,   rate: 0.014 },
    { min: 20000,   max: 50000,   rate: 0.0175 },
    { min: 50000,   max: 70000,   rate: 0.0245 },
    { min: 70000,   max: 80000,   rate: 0.035 },
    { min: 80000,   max: 150000,  rate: 0.05525 },
    { min: 150000,  max: 500000,  rate: 0.0637 },
    { min: 500000,  max: 1000000, rate: 0.0897 },
    { min: 1000000, max: Infinity, rate: 0.1075 },
  ],
};

// ─── NJ Personal Exemptions (2025) ──────────────────────────────
// NJ does NOT have a standard deduction. Instead it uses personal exemptions.
// $1,000 per person: taxpayer, spouse (if MFJ), and each dependent.
export const NJ_PERSONAL_EXEMPTION = 1000;

// ─── NJ Property Tax Deduction/Credit ───────────────────────────
// Residents can deduct up to $15,000 of property taxes paid on a
// principal residence, OR claim a $50 property tax credit (whichever
// is more beneficial — typically the deduction for homeowners).
// ─── NJ Dependent Exemption ───────────────────────────────────
// $1,500 per dependent (higher than the $1,000 personal exemption)
export const NJ_DEPENDENT_EXEMPTION = 1500;

export const NJ_PROPERTY_TAX_DEDUCTION_MAX = 15000;
export const NJ_PROPERTY_TAX_CREDIT = 50;

// ─── NJ Retirement Income Exclusion Thresholds ──────────────────
// NJ provides an exclusion for pension/retirement income for residents
// with gross income under certain thresholds.
export const NJ_RETIREMENT_EXCLUSION_THRESHOLD: Record<string, number> = {
  single: 100000,
  married_joint: 100000,
  married_separate: 50000,
  head_of_household: 75000,
};

export const NJ_RETIREMENT_EXCLUSION_MAX: Record<string, number> = {
  single: 75000,
  married_joint: 100000,
  married_separate: 50000,
  head_of_household: 75000,
};
