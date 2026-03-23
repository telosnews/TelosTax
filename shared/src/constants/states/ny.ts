/**
 * New York State Tax Constants — Tax Year 2025
 *
 * Sources:
 *   - NY Tax Law §601 — New York State income tax
 *   - NY Tax Law §1304 — New York City income tax
 *   - NY Tax Law §1323 — Yonkers surcharge
 */

import { StateTaxBracket } from '../../types/index.js';

// ─── NYS Income Tax Brackets (2025) ────────────────────────────
// Progressive rate schedule per filing status

export const NY_BRACKETS: Record<string, StateTaxBracket[]> = {
  single: [
    { min: 0,       max: 8500,    rate: 0.04 },
    { min: 8500,    max: 11700,   rate: 0.045 },
    { min: 11700,   max: 13900,   rate: 0.0525 },
    { min: 13900,   max: 80650,   rate: 0.055 },
    { min: 80650,   max: 215400,  rate: 0.06 },
    { min: 215400,  max: 1077550, rate: 0.0685 },
    { min: 1077550, max: 5000000, rate: 0.0965 },
    { min: 5000000, max: 25000000, rate: 0.103 },
    { min: 25000000, max: Infinity, rate: 0.109 },
  ],
  married_joint: [
    { min: 0,       max: 17150,   rate: 0.04 },
    { min: 17150,   max: 23600,   rate: 0.045 },
    { min: 23600,   max: 27900,   rate: 0.0525 },
    { min: 27900,   max: 161550,  rate: 0.055 },
    { min: 161550,  max: 323200,  rate: 0.06 },
    { min: 323200,  max: 2155350, rate: 0.0685 },
    { min: 2155350, max: 5000000, rate: 0.0965 },
    { min: 5000000, max: 25000000, rate: 0.103 },
    { min: 25000000, max: Infinity, rate: 0.109 },
  ],
  married_separate: [
    { min: 0,       max: 8500,    rate: 0.04 },
    { min: 8500,    max: 11700,   rate: 0.045 },
    { min: 11700,   max: 13900,   rate: 0.0525 },
    { min: 13900,   max: 80650,   rate: 0.055 },
    { min: 80650,   max: 215400,  rate: 0.06 },
    { min: 215400,  max: 1077550, rate: 0.0685 },
    { min: 1077550, max: 5000000, rate: 0.0965 },
    { min: 5000000, max: 25000000, rate: 0.103 },
    { min: 25000000, max: Infinity, rate: 0.109 },
  ],
  head_of_household: [
    { min: 0,       max: 12800,   rate: 0.04 },
    { min: 12800,   max: 17650,   rate: 0.045 },
    { min: 17650,   max: 20900,   rate: 0.0525 },
    { min: 20900,   max: 107650,  rate: 0.055 },
    { min: 107650,  max: 269300,  rate: 0.06 },
    { min: 269300,  max: 1616450, rate: 0.0685 },
    { min: 1616450, max: 5000000, rate: 0.0965 },
    { min: 5000000, max: 25000000, rate: 0.103 },
    { min: 25000000, max: Infinity, rate: 0.109 },
  ],
};

// ─── NYS Standard Deduction (2025) ──────────────────────────────
export const NY_STANDARD_DEDUCTION: Record<string, number> = {
  single: 8000,
  married_joint: 16050,
  married_separate: 8000,
  head_of_household: 11200,
};

// ─── NYS Personal Exemption ─────────────────────────────────────
export const NY_DEPENDENT_EXEMPTION = 1000;

// ─── NYC Income Tax Brackets (2025) ─────────────────────────────
export const NYC_BRACKETS: Record<string, StateTaxBracket[]> = {
  single: [
    { min: 0,     max: 12000,  rate: 0.03078 },
    { min: 12000, max: 25000,  rate: 0.03762 },
    { min: 25000, max: 50000,  rate: 0.03819 },
    { min: 50000, max: Infinity, rate: 0.03876 },
  ],
  married_joint: [
    { min: 0,     max: 21600,  rate: 0.03078 },
    { min: 21600, max: 45000,  rate: 0.03762 },
    { min: 45000, max: 90000,  rate: 0.03819 },
    { min: 90000, max: Infinity, rate: 0.03876 },
  ],
  married_separate: [
    { min: 0,     max: 12000,  rate: 0.03078 },
    { min: 12000, max: 25000,  rate: 0.03762 },
    { min: 25000, max: 50000,  rate: 0.03819 },
    { min: 50000, max: Infinity, rate: 0.03876 },
  ],
  head_of_household: [
    { min: 0,     max: 14400,  rate: 0.03078 },
    { min: 14400, max: 30000,  rate: 0.03762 },
    { min: 30000, max: 60000,  rate: 0.03819 },
    { min: 60000, max: Infinity, rate: 0.03876 },
  ],
};

// ─── Yonkers Surcharge ──────────────────────────────────────────
// Yonkers residents pay a surcharge on their NYS tax (not on income)
export const YONKERS_RESIDENT_SURCHARGE_RATE = 0.1675;   // 16.75% of NYS tax — IT-201 p.17
export const YONKERS_NONRESIDENT_RATE = 0.005;           // 0.5% of wages earned in Yonkers

// ─── NY STAR Credit ─────────────────────────────────────────────
// School Tax Relief — property tax credit for homeowners
export const NY_STAR_CREDIT_MAX = 350;  // Basic STAR max credit
export const NY_STAR_AGI_LIMIT = 250000;

// ─── Supplemental Tax (Recapture) — IT-201 pp.34-39 ─────────────
export const NY_SUPPLEMENTAL_AGI_THRESHOLD = 107650;
export const NY_SUPPLEMENTAL_FLAT_STOP_AGI = 157650;
export const NY_SUPPLEMENTAL_PHASE_RANGE = 50000;
export const NY_SUPPLEMENTAL_TOP_AGI = 25000000;

export interface NYFirstWorksheet {
  flatRate: number;
  maxTaxableIncome: number;
}

export const NY_FIRST_WORKSHEET: Record<string, NYFirstWorksheet> = {
  married_joint:     { flatRate: 0.055, maxTaxableIncome: 161550 },
  single:            { flatRate: 0.06,  maxTaxableIncome: 215400 },
  married_separate:  { flatRate: 0.06,  maxTaxableIncome: 215400 },
  head_of_household: { flatRate: 0.06,  maxTaxableIncome: 269300 },
};

export interface NYSupplementalWorksheet {
  agiThreshold: number;
  recaptureBase: number;
  incrementalBenefit: number;
}

export const NY_SUPPLEMENTAL_WORKSHEETS: Record<string, NYSupplementalWorksheet[]> = {
  married_joint: [
    { agiThreshold: 161550,  recaptureBase: 333,    incrementalBenefit: 807 },
    { agiThreshold: 323200,  recaptureBase: 1140,   incrementalBenefit: 2747 },
    { agiThreshold: 2155350, recaptureBase: 3887,   incrementalBenefit: 60350 },
    { agiThreshold: 5000000, recaptureBase: 64237,  incrementalBenefit: 32500 },
  ],
  single: [
    { agiThreshold: 215400,  recaptureBase: 568,    incrementalBenefit: 1831 },
    { agiThreshold: 1077550, recaptureBase: 2399,   incrementalBenefit: 30172 },
    { agiThreshold: 5000000, recaptureBase: 32571,  incrementalBenefit: 32500 },
  ],
  married_separate: [
    { agiThreshold: 215400,  recaptureBase: 568,    incrementalBenefit: 1831 },
    { agiThreshold: 1077550, recaptureBase: 2399,   incrementalBenefit: 30172 },
    { agiThreshold: 5000000, recaptureBase: 32571,  incrementalBenefit: 32500 },
  ],
  head_of_household: [
    { agiThreshold: 269300,  recaptureBase: 787,    incrementalBenefit: 2289 },
    { agiThreshold: 1616450, recaptureBase: 3076,   incrementalBenefit: 45261 },
    { agiThreshold: 5000000, recaptureBase: 48337,  incrementalBenefit: 32500 },
  ],
};

// ─── NYC Household Credit (Tables 4-6, IT-201 p.14) ─────────────
export const NYC_HOUSEHOLD_CREDIT_SINGLE: { maxAGI: number; credit: number }[] = [
  { maxAGI: 10000, credit: 15 },
  { maxAGI: 12500, credit: 10 },
];
export const NYC_HOUSEHOLD_CREDIT_PER_DEP: { maxAGI: number; perDep: number }[] = [
  { maxAGI: 15000, perDep: 30 },
  { maxAGI: 17500, perDep: 25 },
  { maxAGI: 20000, perDep: 15 },
  { maxAGI: 22500, perDep: 10 },
];
export const NYC_HOUSEHOLD_CREDIT_MFS_PER_DEP: { maxAGI: number; perDep: number }[] = [
  { maxAGI: 15000, perDep: 15 },
  { maxAGI: 17500, perDep: 13 },
  { maxAGI: 20000, perDep: 8 },
  { maxAGI: 22500, perDep: 5 },
];

// ─── NYC School Tax Credit (IT-201 pp.20-21) ────────────────────
export const NYC_SCHOOL_TAX_CREDIT_FIXED: Record<string, number> = {
  single: 63, married_joint: 125, married_separate: 63, head_of_household: 63,
};
export const NYC_SCHOOL_TAX_CREDIT_INCOME_LIMIT = 250000;

export const NYC_SCHOOL_TAX_RATE_REDUCTION: Record<string, { threshold: number; base: number; rate: number }> = {
  single:            { threshold: 12000, base: 21, rate: 0.00228 },
  married_joint:     { threshold: 21600, base: 37, rate: 0.00228 },
  married_separate:  { threshold: 12000, base: 21, rate: 0.00228 },
  head_of_household: { threshold: 14400, base: 25, rate: 0.00228 },
};
export const NYC_SCHOOL_TAX_RATE_REDUCTION_LOW_RATE = 0.00171;
export const NYC_SCHOOL_TAX_RATE_REDUCTION_INCOME_LIMIT = 500000;

// ─── MCTMT (IT-201 p.17) ────────────────────────────────────────
export const MCTMT_ZONE1_RATE = 0.006;
export const MCTMT_ZONE2_RATE = 0.0034;
export const MCTMT_THRESHOLD = 50000;

// ─── Empire State Child Credit (IT-213, Line 63) ────────────────
// New for 2025: $1,000 per qualifying child under 4; $330 per child ages 4-16
export const NY_ESCC_PER_CHILD_UNDER_4 = 1000;
export const NY_ESCC_PER_CHILD_4_TO_16 = 330;
export const NY_ESCC_PHASE_OUT_PER_1000 = 16.50;
export const NY_ESCC_FEDERAL_CTC_RATE = 0.33;
export const NY_ESCC_AGI_THRESHOLD: Record<string, number> = {
  single: 75000,
  married_joint: 110000,
  married_separate: 55000,
  head_of_household: 75000,
};

// ─── NY/NYC Child & Dependent Care Credit (IT-216, Line 64) ─────
// NYS credit = percentage of federal dependent care credit, by NY AGI
export const NY_DEPENDENT_CARE_TABLE: { maxAGI: number; rate: number }[] = [
  { maxAGI: 25000,  rate: 1.10 },   // 110%
  { maxAGI: 30000,  rate: 1.00 },
  { maxAGI: 35000,  rate: 0.90 },
  { maxAGI: 40000,  rate: 0.80 },
  { maxAGI: 45000,  rate: 0.75 },
  { maxAGI: 50000,  rate: 0.70 },
  { maxAGI: 55000,  rate: 0.65 },
  { maxAGI: 60000,  rate: 0.60 },
  { maxAGI: 65000,  rate: 0.50 },
  { maxAGI: 150000, rate: 0.20 },
  // Above $150K → $0
];
export const NYC_DEPENDENT_CARE_MAX_AGI = 30000;
export const NYC_DEPENDENT_CARE_RATE = 0.75;  // 75% of NYS credit

// ─── College Tuition Credit (IT-272, Line 68) ───────────────────
export const NY_COLLEGE_TUITION_CREDIT_RATE = 0.04;
export const NY_COLLEGE_TUITION_CREDIT_MAX = 400;  // per student

// ─── NYC Income Tax Elimination Credit (IT-270, Line 70a) ───────
// Based on 150% of 2023 federal poverty thresholds by household size
// Household size = filer + spouse (if MFJ) + dependents
export const NYC_TAX_ELIMINATION_THRESHOLDS: number[] = [
  0,      // size 0 (N/A)
  0,      // size 1 (N/A — requires dependents, so min size is 2)
  29580,  // size 2: 150% × $19,720
  37290,  // size 3: 150% × $24,860
  45000,  // size 4: 150% × $30,000
  52710,  // size 5: 150% × $35,140
  60420,  // size 6: 150% × $40,280
  68130,  // size 7: 150% × $45,420
  75840,  // size 8: 150% × $50,560
];
export const NYC_TAX_ELIMINATION_PER_ADDITIONAL = 7710; // per person above 8
export const NYC_TAX_ELIMINATION_PHASE_OUT = 5000;      // $5K phase-out range
