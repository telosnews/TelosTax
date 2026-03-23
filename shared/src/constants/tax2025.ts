import { FilingStatus, TaxBracket } from '../types/index.js';

// ──────────────────────────────────────────────────
// 2025 Federal Tax Brackets
// Authority: IRC §1(a)-(d), (j) — Tax imposed; TCJA §11001 — Rate structure
// Constants: Rev. Proc. 2024-40, Section 3.01, Table 1 — Taxable income brackets
// ──────────────────────────────────────────────────

export const TAX_BRACKETS_2025: Record<FilingStatus, TaxBracket[]> = {
  [FilingStatus.Single]: [
    { min: 0, max: 11925, rate: 0.10 },
    { min: 11925, max: 48475, rate: 0.12 },
    { min: 48475, max: 103350, rate: 0.22 },
    { min: 103350, max: 197300, rate: 0.24 },
    { min: 197300, max: 250525, rate: 0.32 },
    { min: 250525, max: 626350, rate: 0.35 },
    { min: 626350, max: Infinity, rate: 0.37 },
  ],
  [FilingStatus.MarriedFilingJointly]: [
    { min: 0, max: 23850, rate: 0.10 },
    { min: 23850, max: 96950, rate: 0.12 },
    { min: 96950, max: 206700, rate: 0.22 },
    { min: 206700, max: 394600, rate: 0.24 },
    { min: 394600, max: 501050, rate: 0.32 },
    { min: 501050, max: 751600, rate: 0.35 },
    { min: 751600, max: Infinity, rate: 0.37 },
  ],
  [FilingStatus.MarriedFilingSeparately]: [
    { min: 0, max: 11925, rate: 0.10 },
    { min: 11925, max: 48475, rate: 0.12 },
    { min: 48475, max: 103350, rate: 0.22 },
    { min: 103350, max: 197300, rate: 0.24 },
    { min: 197300, max: 250525, rate: 0.32 },
    { min: 250525, max: 375800, rate: 0.35 },
    { min: 375800, max: Infinity, rate: 0.37 },
  ],
  [FilingStatus.HeadOfHousehold]: [
    { min: 0, max: 17000, rate: 0.10 },
    { min: 17000, max: 64850, rate: 0.12 },
    { min: 64850, max: 103350, rate: 0.22 },
    { min: 103350, max: 197300, rate: 0.24 },
    { min: 197300, max: 250500, rate: 0.32 },
    { min: 250500, max: 626350, rate: 0.35 },
    { min: 626350, max: Infinity, rate: 0.37 },
  ],
  [FilingStatus.QualifyingSurvivingSpouse]: [
    { min: 0, max: 23850, rate: 0.10 },
    { min: 23850, max: 96950, rate: 0.12 },
    { min: 96950, max: 206700, rate: 0.22 },
    { min: 206700, max: 394600, rate: 0.24 },
    { min: 394600, max: 501050, rate: 0.32 },
    { min: 501050, max: 751600, rate: 0.35 },
    { min: 751600, max: Infinity, rate: 0.37 },
  ],
};

// ──────────────────────────────────────────────────
// Standard Deduction
// Authority: IRC §63(c) — Standard deduction defined; TCJA §11021 — Increased amounts
// Constants: Rev. Proc. 2024-40, Section 3.02, Table 5 — Standard deduction amounts
// ──────────────────────────────────────────────────

export const STANDARD_DEDUCTION_2025: Record<FilingStatus, number> = {
  [FilingStatus.Single]: 15750,                    // OBBBA §11021 — Increased from $15,000 to $15,750
  [FilingStatus.MarriedFilingJointly]: 31500,      // OBBBA §11021 — Increased from $30,000 to $31,500
  [FilingStatus.MarriedFilingSeparately]: 15750,   // OBBBA §11021 — Increased from $15,000 to $15,750
  [FilingStatus.HeadOfHousehold]: 23625,           // OBBBA §11021 — Increased from $22,500 to $23,625
  [FilingStatus.QualifyingSurvivingSpouse]: 31500, // OBBBA §11021 — Increased from $30,000 to $31,500 (same as MFJ)
};

// Additional standard deduction for age 65+ and/or blind
// Authority: IRC §63(f) — Additional amounts for aged/blind
// Constants: Rev. Proc. 2024-40, Section 3.02
export const ADDITIONAL_STANDARD_DEDUCTION = {
  UNMARRIED: 2000,   // Single, HoH — Rev. Proc. 2024-40 §3.02
  MARRIED: 1600,     // MFJ, MFS — Rev. Proc. 2024-40 §3.02
};

// Dependent standard deduction (reduced amount for filers claimed as dependents)
// Authority: IRC §63(c)(5) — Limitation on standard deduction for dependents
// Constants: Rev. Proc. 2024-40, Section 3.02
export const DEPENDENT_STANDARD_DEDUCTION = {
  MIN_AMOUNT: 1350,         // Minimum standard deduction for dependents — Rev. Proc. 2024-40 §3.02
  EARNED_INCOME_PLUS: 450,  // Greater of MIN_AMOUNT or (earned income + 450) — Rev. Proc. 2024-40 §3.02
};

// ──────────────────────────────────────────────────
// Self-Employment Tax
// Authority: IRC §1401(a) — SS rate on SE income; IRC §1401(b) — Medicare rate
//           IRC §1402(a) — Definition of net earnings from SE
//           IRC §3101(b)(2) — Additional Medicare Tax (0.9%)
// Constants: Rev. Proc. 2024-40 §3 — SS wage base; SSA announcement — $176,100 for 2025
// ──────────────────────────────────────────────────

export const SE_TAX = {
  RATE: 0.153,                    // 15.3% total — IRC §1401(a) 12.4% + IRC §1401(b) 2.9%
  SS_RATE: 0.124,                 // IRC §1401(a) — OASDI (Social Security) rate
  MEDICARE_RATE: 0.029,           // IRC §1401(b)(1) — Hospital Insurance (Medicare) rate
  SS_WAGE_BASE: 176100,           // SSA COLA announcement, Oct 2024 — 2025 SS wage base
  NET_EARNINGS_FACTOR: 0.9235,    // IRC §1402(a)(12) — 92.35% of net profit (equivalent of employer half deduction)
  ADDITIONAL_MEDICARE_RATE: 0.009, // IRC §3101(b)(2), ACA §9015 — 0.9% additional Medicare tax
  ADDITIONAL_MEDICARE_THRESHOLD_SINGLE: 200000,  // IRC §3101(b)(2)(B)(i) — $200k Single/HoH
  ADDITIONAL_MEDICARE_THRESHOLD_MFJ: 250000,     // IRC §3101(b)(2)(B)(ii) — $250k MFJ
  ADDITIONAL_MEDICARE_THRESHOLD_MFS: 125000,     // IRC §3101(b)(2)(B)(iii) — $125k MFS
  MINIMUM_EARNINGS_THRESHOLD: 400,               // IRC §1402(b) — SE tax applies only if net SE earnings ≥ $400
  FARM_OPTIONAL_METHOD_MAX: 7240,                // Schedule SE Part II §A, Line 14 — max net earnings under farm optional method (2025)
};

// ──────────────────────────────────────────────────
// Qualified Business Income (QBI) Deduction
// Authority: IRC §199A — Qualified business income deduction (20%); TCJA §11011
// Constants: Rev. Proc. 2024-40, Section 3.29 — Threshold amounts
// ──────────────────────────────────────────────────

export const QBI = {
  RATE: 0.20,                     // IRC §199A(a) — 20% deduction rate
  THRESHOLD_SINGLE: 197300,       // Rev. Proc. 2024-40 §3.29 — Single/HoH threshold
  THRESHOLD_MFJ: 394600,         // Rev. Proc. 2024-40 §3.29 — MFJ threshold
  PHASE_IN_RANGE_SINGLE: 50000,  // IRC §199A(e)(2)(A) — $50k phase-in range (Single)
  PHASE_IN_RANGE_MFJ: 100000,    // IRC §199A(e)(2)(B) — $100k phase-in range (MFJ)
};

// ──────────────────────────────────────────────────
// Home Office
// Authority: IRC §280A(c) — Home office deduction requirements
// Constants: Rev. Proc. 2013-13 — Simplified method ($5/sq ft, max 300 sq ft)
// ──────────────────────────────────────────────────

export const HOME_OFFICE = {
  SIMPLIFIED_RATE: 5,             // Rev. Proc. 2013-13 §4.01 — $5 per sq ft
  SIMPLIFIED_MAX_SQFT: 300,       // Rev. Proc. 2013-13 §4.01 — Max 300 sq ft
  SIMPLIFIED_MAX_DEDUCTION: 1500, // Rev. Proc. 2013-13 §4.01 — $5 × 300 = $1,500
};

// ──────────────────────────────────────────────────
// Home Office Depreciation (MACRS — Residential Property)
// Authority: IRC §168 — Accelerated cost recovery system
// Constants: IRS Pub 946, Table A-6 — Residential Rental Property (27.5-year)
// Mid-month convention per IRC §168(d)(2)
// ──────────────────────────────────────────────────

export const HOME_OFFICE_DEPRECIATION = {
  RECOVERY_YEARS: 27.5,  // Residential property, 27.5-year class

  // First-year depreciation percentage by month placed in service (2025)
  // Source: IRS Pub 946, Table A-6 (27.5-year, mid-month convention)
  // Each value = (remaining months + 0.5) / (27.5 × 12)
  FIRST_YEAR_RATE_BY_MONTH: {
    1:  0.03485,   // January   (11.5 months / 330)
    2:  0.03182,   // February  (10.5 / 330)
    3:  0.02879,   // March     (9.5 / 330)
    4:  0.02576,   // April     (8.5 / 330)
    5:  0.02273,   // May       (7.5 / 330)
    6:  0.01970,   // June      (6.5 / 330)
    7:  0.01667,   // July      (5.5 / 330)
    8:  0.01364,   // August    (4.5 / 330)
    9:  0.01061,   // September (3.5 / 330)
    10: 0.00758,   // October   (2.5 / 330)
    11: 0.00455,   // November  (1.5 / 330)
    12: 0.00152,   // December  (0.5 / 330)
  } as Record<number, number>,

  // Subsequent-year rate (years 2 through 27.5)
  // Full 12 months / (27.5 × 12) = 12/330 = 0.03636
  SUBSEQUENT_YEAR_RATE: 0.03636,
};

// ──────────────────────────────────────────────────
// Vehicle / Standard Mileage
// Authority: IRC §162 — Business expenses; IRC §274(d) — Substantiation requirements
// Constants: IRS Notice 2024-79 — Standard mileage rate for 2025
// ──────────────────────────────────────────────────

export const VEHICLE = {
  STANDARD_MILEAGE_RATE: 0.70,    // IRS Notice 2024-79 — $0.70/mile for 2025
};

// ──────────────────────────────────────────────────
// Vehicle Depreciation (MACRS 5-Year / Section 280F)
// Authority: IRC §168 — MACRS; IRC §280F — Luxury vehicle limits
//           IRC §168(k) — Bonus depreciation (100% restored by OBBBA for 2025)
// Constants: Rev. Proc. 2025-16 — Section 280F dollar amounts for 2025
// ──────────────────────────────────────────────────

export const VEHICLE_DEPRECIATION = {
  // Section 280F limits WITH 100% bonus depreciation (Rev. Proc. 2025-16)
  SECTION_280F_LIMITS_BONUS: {
    year1: 20200,     // First year with bonus depreciation
    year2: 19600,     // Second year
    year3: 11800,     // Third year
    year4Plus: 7060,  // Fourth and subsequent years
  } as Record<string, number>,

  // Section 280F limits WITHOUT bonus depreciation
  SECTION_280F_LIMITS_NO_BONUS: {
    year1: 12200,     // First year without bonus
    year2: 19600,
    year3: 11800,
    year4Plus: 7060,
  } as Record<string, number>,

  // 5-Year MACRS rates (200% declining balance, half-year convention)
  // IRS Pub 946, Table A-1 (GDS, 200% DB, half-year)
  MACRS_5_YEAR_RATES: [0.20, 0.32, 0.192, 0.1152, 0.1152, 0.0576] as readonly number[],

  // 5-Year straight-line rates (half-year convention)
  // Required when business use ≤ 50% per IRC §280F(b)(1)
  // IRS Pub 946, Table A-8 (GDS, straight-line, half-year)
  STRAIGHT_LINE_5_YEAR_RATES: [0.10, 0.20, 0.20, 0.20, 0.20, 0.10] as readonly number[],

  // SUV/heavy vehicle Section 179 limit (vehicles over 6,000 lbs GVW)
  SUV_SECTION_179_LIMIT: 31300,

  // Bonus depreciation rate — OBBBA restores 100% for 2025
  BONUS_DEPRECIATION_RATE: 1.0,

  // Tax year for year-in-service calculation
  TAX_YEAR: 2025,
};

// ──────────────────────────────────────────────────
// Form 4562 — Section 179 & MACRS General Depreciation
// Authority: IRC §179 — Election to expense certain depreciable business assets
//           IRC §168 — Accelerated cost recovery system (MACRS)
//           IRC §168(k) — Bonus depreciation (100% restored by OBBBA for 2025)
// Constants: Rev. Proc. 2024-40, Section 3 — Section 179 dollar limits for 2025
//           IRS Pub 946, Table A-1 — GDS 200% DB, half-year convention
// ──────────────────────────────────────────────────

export const SECTION_179 = {
  /** Maximum Section 179 deduction for 2025. OBBBA §70306 (doubled from Rev. Proc. 2024-40). */
  MAX_DEDUCTION: 2500000,
  /** Total cost threshold — deduction reduced dollar-for-dollar above this amount. OBBBA §70306. */
  PHASE_OUT_THRESHOLD: 4000000,
  /** SUV limit for vehicles > 6,000 lbs GVW (IRC §179(b)(5)(A)). */
  SUV_LIMIT: 31300,
} as const;

/**
 * MACRS GDS depreciation rate tables (200% declining balance, half-year convention).
 * Source: IRS Publication 946, Table A-1.
 *
 * Key = recovery period in years. Value = array of annual rates (0-indexed).
 * Year 0 = first year placed in service (half-year convention).
 * Each array sums to 1.0 (100% of basis recovered over the recovery period + 1 years).
 */
export const MACRS_GDS_RATES: Record<number, readonly number[]> = {
  3:  [0.3333, 0.4445, 0.1481, 0.0741],
  5:  [0.2000, 0.3200, 0.1920, 0.1152, 0.1152, 0.0576],
  7:  [0.1429, 0.2449, 0.1749, 0.1249, 0.0893, 0.0892, 0.0893, 0.0446],
  10: [0.1000, 0.1800, 0.1440, 0.1152, 0.0922, 0.0737, 0.0655, 0.0655, 0.0656, 0.0655, 0.0328],
  15: [0.0500, 0.0950, 0.0855, 0.0770, 0.0693, 0.0623, 0.0590, 0.0590, 0.0591, 0.0590, 0.0591, 0.0590, 0.0591, 0.0590, 0.0591, 0.0295],
  20: [0.0375, 0.0722, 0.0668, 0.0618, 0.0571, 0.0528, 0.0489, 0.0452, 0.0447, 0.0447, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0223],
};

/**
 * MACRS GDS depreciation rate tables — mid-quarter convention.
 * Source: IRS Publication 946, Appendix A, Tables A-2 through A-5 (200% DB)
 *         and Tables A-2a through A-5a (150% DB, for 15/20-year property).
 *
 * Key = recovery period in years.
 * Value = array of 4 rate arrays, indexed by quarter placed in service (0 = Q1, 3 = Q4).
 * Each rate array has (recoveryPeriod + 1) entries and sums to 1.0.
 *
 * The mid-quarter convention is required under IRC §168(d)(3) when more than 40%
 * of the aggregate depreciable basis placed in service during the tax year is placed
 * in service during the last 3 months of the tax year.
 */
export const MACRS_GDS_RATES_MID_QUARTER: Record<number, readonly (readonly number[])[]> = {
  // ── 3-Year Property (200% DB, mid-quarter) ─────────────────
  3: [
    [0.5833, 0.2778, 0.0926, 0.0463],  // Q1
    [0.4167, 0.3889, 0.1414, 0.0530],  // Q2
    [0.2500, 0.5000, 0.1667, 0.0833],  // Q3
    [0.0833, 0.6111, 0.2037, 0.1019],  // Q4
  ],
  // ── 5-Year Property (200% DB, mid-quarter) ─────────────────
  5: [
    [0.3500, 0.2600, 0.1560, 0.1101, 0.1101, 0.0138],  // Q1
    [0.2500, 0.3000, 0.1800, 0.1137, 0.1137, 0.0426],  // Q2
    [0.1500, 0.3400, 0.2040, 0.1224, 0.1130, 0.0706],  // Q3
    [0.0500, 0.3800, 0.2280, 0.1368, 0.1094, 0.0958],  // Q4
  ],
  // ── 7-Year Property (200% DB, mid-quarter) ─────────────────
  7: [
    [0.2500, 0.2143, 0.1531, 0.1093, 0.0875, 0.0874, 0.0875, 0.0109],  // Q1
    [0.1785, 0.2347, 0.1676, 0.1197, 0.0887, 0.0887, 0.0887, 0.0334],  // Q2
    [0.1071, 0.2551, 0.1822, 0.1302, 0.0930, 0.0885, 0.0886, 0.0553],  // Q3
    [0.0357, 0.2755, 0.1968, 0.1406, 0.1004, 0.0873, 0.0873, 0.0764],  // Q4
  ],
  // ── 10-Year Property (200% DB, mid-quarter) ────────────────
  10: [
    [0.1750, 0.1650, 0.1320, 0.1056, 0.0845, 0.0676, 0.0655, 0.0655, 0.0656, 0.0655, 0.0082],  // Q1
    [0.1250, 0.1750, 0.1400, 0.1120, 0.0896, 0.0717, 0.0655, 0.0655, 0.0656, 0.0655, 0.0246],  // Q2
    [0.0750, 0.1850, 0.1480, 0.1184, 0.0947, 0.0758, 0.0655, 0.0655, 0.0656, 0.0655, 0.0410],  // Q3
    [0.0250, 0.1950, 0.1560, 0.1248, 0.0998, 0.0799, 0.0655, 0.0655, 0.0656, 0.0655, 0.0574],  // Q4
  ],
  // ── 15-Year Property (150% DB, mid-quarter) ────────────────
  15: [
    [0.0875, 0.0913, 0.0821, 0.0739, 0.0665, 0.0599, 0.0590, 0.0591, 0.0590, 0.0591, 0.0590, 0.0591, 0.0590, 0.0591, 0.0590, 0.0074],  // Q1
    [0.0625, 0.0938, 0.0844, 0.0759, 0.0683, 0.0615, 0.0591, 0.0590, 0.0591, 0.0590, 0.0591, 0.0590, 0.0591, 0.0590, 0.0591, 0.0221],  // Q2
    [0.0375, 0.0963, 0.0866, 0.0780, 0.0702, 0.0632, 0.0590, 0.0591, 0.0590, 0.0591, 0.0590, 0.0591, 0.0590, 0.0591, 0.0590, 0.0368],  // Q3
    [0.0125, 0.0988, 0.0889, 0.0800, 0.0720, 0.0648, 0.0590, 0.0591, 0.0590, 0.0591, 0.0590, 0.0591, 0.0590, 0.0591, 0.0590, 0.0516],  // Q4
  ],
  // ── 20-Year Property (150% DB, mid-quarter) ────────────────
  20: [
    [0.0656, 0.0701, 0.0648, 0.0600, 0.0555, 0.0513, 0.0475, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0054],  // Q1
    [0.0469, 0.0715, 0.0661, 0.0612, 0.0566, 0.0523, 0.0484, 0.0448, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0170],  // Q2
    [0.0281, 0.0729, 0.0674, 0.0624, 0.0577, 0.0534, 0.0494, 0.0457, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0278],  // Q3
    [0.0094, 0.0743, 0.0687, 0.0636, 0.0588, 0.0544, 0.0503, 0.0465, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0388],  // Q4
  ],
};

/** Bonus depreciation rate for 2025 (100% restored by OBBBA). IRC §168(k). */
export const BONUS_DEPRECIATION_RATE_2025 = 1.0;

/** Tax year for MACRS year-index computation. */
export const DEPRECIATION_TAX_YEAR = 2025;

// ──────────────────────────────────────────────────
// Schedule A / Itemized Deductions
// Authority: IRC §164(b)(6) — SALT cap; IRC §163(h)(3) — Mortgage interest
//           IRC §170 — Charitable contributions; IRC §213(a) — Medical expenses
//           TCJA §11042 / OBBBA — SALT limitation ($40k for 2025-2029); TCJA §11043 — Mortgage limit
// ──────────────────────────────────────────────────

export const SCHEDULE_A = {
  SALT_CAP: 40000,                // OBBBA Working Families Tax Cut Act — $40,000 SALT cap (2025-2029)
  SALT_CAP_MFS: 20000,            // OBBBA — $20,000 if MFS (2025-2029)
  SALT_PHASE_DOWN_THRESHOLD: 500000,  // OBBBA — SALT cap reduces above $500k MAGI ($250k MFS)
  SALT_PHASE_DOWN_THRESHOLD_MFS: 250000,
  SALT_PHASE_DOWN_RATE: 0.30,      // OBBBA — Cap reduced by 30% of excess MAGI
  SALT_CAP_FLOOR: 10000,          // OBBBA — SALT cap cannot go below $10,000
  SALT_CAP_FLOOR_MFS: 5000,       // OBBBA — $5,000 floor if MFS
  MEDICAL_AGI_THRESHOLD: 0.075,   // IRC §213(a), TCJA §11027 — 7.5% of AGI floor (permanent)
  MORTGAGE_LIMIT: 750000,         // TCJA §11043, IRC §163(h)(3)(F)(i)(II) — $750k post-12/15/2017
  MORTGAGE_LIMIT_MFS: 375000,     // IRC §163(h)(3)(F)(i)(II) — $375,000 if MFS
};

// ──────────────────────────────────────────────────
// Child Tax Credit
// Authority: IRC §24(a) — $2,000 CTC per qualifying child; IRC §24(h) — TCJA modifications
//           IRC §24(d) — ACTC (refundable portion); TCJA §11022
// Constants: Rev. Proc. 2024-40, Section 3.23 — CTC refundable max ($1,700)
// ──────────────────────────────────────────────────

export const CHILD_TAX_CREDIT = {
  PER_CHILD: 2200,                // OBBBA — Increased from $2,000 to $2,200 per qualifying child (under 17)
  PER_OTHER_DEPENDENT: 500,       // IRC §24(h)(4) — $500 per other dependent (ODC)
  PHASE_OUT_THRESHOLD_SINGLE: 200000, // IRC §24(b)(2) — $200k (S/HoH/MFS)
  PHASE_OUT_THRESHOLD_MFJ: 400000,    // IRC §24(b)(2) — $400k (MFJ)
  PHASE_OUT_RATE: 50,             // IRC §24(b)(1) — $50 reduction per $1,000 over threshold
  REFUNDABLE_MAX: 1700,           // OBBBA — Max ACTC per child for 2025
};

// ──────────────────────────────────────────────────
// Education Credits
// Authority: IRC §25A(b) — AOTC; IRC §25A(c) — LLC; IRC §25A(i) — AOTC modifications
// Constants: Rev. Proc. 2024-40, Section 3.24-3.25 — Phase-out thresholds
// ──────────────────────────────────────────────────

export const EDUCATION_CREDITS = {
  // American Opportunity Tax Credit (AOTC) — IRC §25A(b), (i)
  AOTC_MAX: 2500,                          // IRC §25A(i)(1) — Max $2,500
  AOTC_FIRST_TIER: 2000,                   // IRC §25A(i)(1)(A) — 100% of first $2,000
  AOTC_SECOND_TIER: 2000,                  // IRC §25A(i)(1)(B) — 25% of next $2,000
  AOTC_REFUNDABLE_RATE: 0.40,              // IRC §25A(i)(6) — 40% refundable
  AOTC_PHASE_OUT_SINGLE: 80000,            // IRC §25A(i)(4)(A) — $80k (Single)
  AOTC_PHASE_OUT_RANGE_SINGLE: 10000,      // IRC §25A(i)(4)(A) — $10k range
  AOTC_PHASE_OUT_MFJ: 160000,              // IRC §25A(i)(4)(B) — $160k (MFJ)
  AOTC_PHASE_OUT_RANGE_MFJ: 20000,         // IRC §25A(i)(4)(B) — $20k range

  // Lifetime Learning Credit (LLC) — IRC §25A(c)
  LLC_MAX: 2000,                            // IRC §25A(c)(1) — 20% of $10k = $2,000 max
  LLC_RATE: 0.20,                           // IRC §25A(c)(1) — 20% of qualified expenses
  LLC_PHASE_OUT_SINGLE: 80000,              // Rev. Proc. 2024-40 §3.25 — $80k (Single)
  LLC_PHASE_OUT_RANGE_SINGLE: 10000,        // Rev. Proc. 2024-40 §3.25 — $10k range
  LLC_PHASE_OUT_MFJ: 160000,                // Rev. Proc. 2024-40 §3.25 — $160k (MFJ)
  LLC_PHASE_OUT_RANGE_MFJ: 20000,           // Rev. Proc. 2024-40 §3.25 — $20k range
};

// ──────────────────────────────────────────────────
// Estimated Tax
// Authority: IRC §6654 — Failure to pay estimated income tax; IRC §6654(d)(1) — Required annual payment
// ──────────────────────────────────────────────────

export const ESTIMATED_TAX = {
  QUARTERLY_DIVISOR: 4,                    // IRC §6654(c)(1) — 4 installment periods
  SAFE_HARBOR_RATE: 1.0,                   // IRC §6654(d)(1)(B)(i) — 100% of prior year tax
  HIGH_INCOME_SAFE_HARBOR: 1.10,           // IRC §6654(d)(1)(C)(i) — 110% if prior year AGI > $150k
  HIGH_INCOME_THRESHOLD: 150000,           // IRC §6654(d)(1)(C)(i) — $150k threshold
};

// ──────────────────────────────────────────────────
// HSA Contribution Limits (2025)
// Authority: IRC §223(b) — Contribution limits; IRC §223(b)(3) — Catch-up contributions
// Constants: Rev. Proc. 2024-25 — HSA contribution limits for 2025
// ──────────────────────────────────────────────────

export const HSA = {
  INDIVIDUAL_LIMIT: 4300,          // Rev. Proc. 2024-25 — Self-only coverage limit
  FAMILY_LIMIT: 8550,              // Rev. Proc. 2024-25 — Family coverage limit
  CATCH_UP_55_PLUS: 1000,          // IRC §223(b)(3)(B) — $1,000 catch-up (not indexed)
};

// ──────────────────────────────────────────────────
// Archer MSA Contribution Limits (2025)
// Authority: IRC §220(b) — Contribution limits; IRC §220(d) — HDHP definition
// Constants: Rev. Proc. 2024-34 — Archer MSA HDHP thresholds
// ──────────────────────────────────────────────────

export const ARCHER_MSA = {
  SELF_ONLY_RATE: 0.65,            // IRC §220(b)(2)(A) — 65% of annual deductible (self-only)
  FAMILY_RATE: 0.75,               // IRC §220(b)(2)(B) — 75% of annual deductible (family)
  // HDHP deductible range — self-only
  SELF_ONLY_DEDUCTIBLE_MIN: 2850,  // Rev. Proc. 2024-34 — Minimum annual deductible
  SELF_ONLY_DEDUCTIBLE_MAX: 4300,  // Rev. Proc. 2024-34 — Maximum annual deductible
  SELF_ONLY_OOP_MAX: 5700,         // Rev. Proc. 2024-34 — Maximum out-of-pocket
  // HDHP deductible range — family
  FAMILY_DEDUCTIBLE_MIN: 5700,     // Rev. Proc. 2024-34 — Minimum annual deductible
  FAMILY_DEDUCTIBLE_MAX: 8550,     // Rev. Proc. 2024-34 — Maximum annual deductible
  FAMILY_OOP_MAX: 10500,           // Rev. Proc. 2024-34 — Maximum out-of-pocket
  EXCESS_TAX_RATE: 0.06,           // IRC §220(f)(4) — 6% excise tax on excess contributions
  DISTRIBUTION_PENALTY_RATE: 0.20, // IRC §220(f)(2) — 20% additional tax on non-medical distributions
};

// ──────────────────────────────────────────────────
// Student Loan Interest Deduction (2025)
// Authority: IRC §221 — Student loan interest deduction
// Constants: Rev. Proc. 2024-40, Section 3.20 — Phase-out thresholds
// ──────────────────────────────────────────────────

export const STUDENT_LOAN_INTEREST = {
  MAX_DEDUCTION: 2500,             // IRC §221(b)(1) — $2,500 max deduction
  PHASE_OUT_SINGLE: 85000,        // IRS Pub 970 (2025) — Single phase-out start ($85k)
  PHASE_OUT_RANGE_SINGLE: 15000,  // IRS Pub 970 (2025) — $15k range ($85k-$100k)
  PHASE_OUT_MFJ: 170000,          // IRS Pub 970 (2025) — MFJ phase-out start ($170k)
  PHASE_OUT_RANGE_MFJ: 30000,     // IRS Pub 970 (2025) — $30k range ($170k-$200k)
};

// ──────────────────────────────────────────────────
// IRA Contribution Limits (2025)
// Authority: IRC §219(b)(5) — Contribution limits; IRC §219(g) — Deduction phase-outs
// Constants: Rev. Proc. 2024-40, Section 3.08-3.10 — IRA limits and phase-outs
// ──────────────────────────────────────────────────

export const IRA = {
  MAX_CONTRIBUTION: 7000,          // Rev. Proc. 2024-40 §3.08 — IRA contribution limit
  CATCH_UP_50_PLUS: 1000,         // IRC §219(b)(5)(B) — $1,000 catch-up (not indexed)
  // Traditional IRA deduction phase-out (covered by workplace plan)
  DEDUCTION_PHASE_OUT_SINGLE: 79000,                  // Rev. Proc. 2024-40 §3.09(1)
  DEDUCTION_PHASE_OUT_RANGE_SINGLE: 10000,             // Rev. Proc. 2024-40 §3.09(1) — $10k range
  DEDUCTION_PHASE_OUT_MFJ: 126000,                    // Rev. Proc. 2024-40 §3.09(2)
  DEDUCTION_PHASE_OUT_RANGE_MFJ: 20000,               // IRS Pub 590-A (2025) — $20k range ($126k-$146k)
  // MFJ where taxpayer is NOT covered but spouse IS covered by employer plan
  DEDUCTION_PHASE_OUT_MFJ_SPOUSE_COVERED: 236000,     // Rev. Proc. 2024-40 §3.09(3)
  DEDUCTION_PHASE_OUT_RANGE_MFJ_SPOUSE_COVERED: 10000, // Rev. Proc. 2024-40 §3.09(3) — $10k range
  // MFS phase-out (covered by employer plan) — IRC §219(g)(7)(A)(ii)
  DEDUCTION_PHASE_OUT_MFS: 0,                          // Phase-out starts at $0 for MFS
  DEDUCTION_PHASE_OUT_RANGE_MFS: 10000,                // $10k range — fully phased out at $10k
};

// ──────────────────────────────────────────────────
// Capital Gains / Qualified Dividends (2025)
// Authority: IRC §1(h) — Preferential rates for net capital gain and qualified dividends
//           IRC §1(h)(1)(B)-(D) — 0%/15%/20% rate tiers
// Constants: Rev. Proc. 2024-40, Section 3.12 — Capital gain rate thresholds
// ──────────────────────────────────────────────────

export const CAPITAL_GAINS_RATES = {
  RATE_0: 0,                       // IRC §1(h)(1)(B) — 0% rate
  RATE_15: 0.15,                   // IRC §1(h)(1)(C) — 15% rate
  RATE_20: 0.20,                   // IRC §1(h)(1)(D) — 20% rate
  RATE_25: 0.25,                   // IRC §1(h)(1)(E) — 25% rate (unrecaptured Section 1250 gain)
  // 0% rate upper thresholds — Rev. Proc. 2024-40 §3.12, Table 3
  THRESHOLD_0: {
    [FilingStatus.Single]: 48350,                    // Rev. Proc. 2024-40 §3.12
    [FilingStatus.MarriedFilingJointly]: 96700,      // Rev. Proc. 2024-40 §3.12
    [FilingStatus.MarriedFilingSeparately]: 48350,   // Rev. Proc. 2024-40 §3.12
    [FilingStatus.HeadOfHousehold]: 64750,           // Rev. Proc. 2024-40 §3.12
    [FilingStatus.QualifyingSurvivingSpouse]: 96700, // Rev. Proc. 2024-40 §3.12
  } as Record<FilingStatus, number>,
  // 15% rate upper thresholds — Rev. Proc. 2024-40 §3.12, Table 3
  THRESHOLD_15: {
    [FilingStatus.Single]: 533400,                   // Rev. Proc. 2024-40 §3.12
    [FilingStatus.MarriedFilingJointly]: 600050,     // Rev. Proc. 2024-40 §3.12
    [FilingStatus.MarriedFilingSeparately]: 300025,  // Rev. Proc. 2024-40 §3.12 (½ of MFJ $600,050)
    [FilingStatus.HeadOfHousehold]: 566700,          // Rev. Proc. 2024-40 §3.12
    [FilingStatus.QualifyingSurvivingSpouse]: 600050, // Rev. Proc. 2024-40 §3.12
  } as Record<FilingStatus, number>,
};

// ──────────────────────────────────────────────────
// Net Investment Income Tax (NIIT)
// Authority: IRC §1411 — Net investment income tax; ACA §1402(a)
// Note: NIIT thresholds are NOT indexed for inflation (statutory amounts)
// ──────────────────────────────────────────────────

export const NIIT = {
  RATE: 0.038,                      // IRC §1411(a)(1) — 3.8% surtax
  THRESHOLD_SINGLE: 200000,        // IRC §1411(b) — $200k (Single)
  THRESHOLD_MFJ: 250000,           // IRC §1411(b) — $250k (MFJ)
  THRESHOLD_MFS: 125000,           // IRC §1411(b) — $125k (MFS)
  THRESHOLD_HOH: 200000,           // IRC §1411(b) — $200k (HoH, same as Single)
  THRESHOLD_QSS: 250000,           // IRC §1411(b) — $250k (QSS, same as MFJ)
};

// ──────────────────────────────────────────────────
// Qualified Charitable Distributions (QCD)
// Authority: IRC §408(d)(8) — Qualified charitable distributions
//           SECURE 2.0 Act §307 — Inflation indexing starting 2024
// ──────────────────────────────────────────────────

export const QCD = {
  MAX_AMOUNT: 105000,             // IRC §408(d)(8)(B) — per-person annual limit (2025, indexed)
  MIN_AGE_MONTHS: 846,            // 70 years 6 months (70½)
};

// ──────────────────────────────────────────────────
// Early Distribution Penalty (Form 5329)
// Authority: IRC §72(t) — 10% additional tax on early distributions
//           IRC §72(t)(2) — Exceptions to early distribution penalty
// ──────────────────────────────────────────────────

export const EARLY_DISTRIBUTION = {
  PENALTY_RATE: 0.10,               // IRC §72(t)(1) — 10% early withdrawal penalty
  PENALTY_CODES: ['1'],             // 1099-R code 1 = early, no exception
  EXCEPTION_CODES: ['2'],           // 1099-R code 2 = early, exception applies per IRC §72(t)(2)
  EXEMPT_CODES: ['3', '4', '7', 'G', 'T'], // No penalty: disability, death, normal, rollover, Roth

  // IRC §72(t)(2) partial exception reason codes for Form 5329 Line 2.
  // When 1099-R uses code 1 (early, no known exception), the taxpayer may still
  // qualify for a partial exception on Form 5329. The exception amount is
  // subtracted from the early distribution amount before applying the 10% penalty.
  //
  // Codes align with Form 5329 instructions — users select the applicable reason
  // and enter the dollar amount that qualifies for the exception.
  EXCEPTION_REASON_CODES: {
    '01': 'Separation from service after age 55 (or age 50 for public safety)',  // IRC §72(t)(2)(A)(v)
    '02': 'SEPP — substantially equal periodic payments',                        // IRC §72(t)(2)(A)(iv)
    '03': 'Disability',                                                          // IRC §72(t)(2)(A)(iii)
    '04': 'Death (beneficiary distribution)',                                    // IRC §72(t)(2)(A)(ii)
    '05': 'Unreimbursed medical expenses exceeding 7.5% of AGI',                // IRC §72(t)(2)(B)
    '06': 'Health insurance premiums while unemployed',                          // IRC §72(t)(2)(D)
    '07': 'IRS levy',                                                            // IRC §72(t)(2)(A)(vii)
    '08': 'Qualified higher education expenses',                                 // IRC §72(t)(2)(E)
    '09': 'First-time homebuyer ($10,000 lifetime max)',                         // IRC §72(t)(2)(F)
    '10': 'Qualified reservist distribution',                                    // IRC §72(t)(2)(G)
    '11': 'Qualified birth or adoption ($5,000 max)',                            // IRC §72(t)(2)(H)
    '12': 'Terminal illness',                                                    // IRC §72(t)(2)(A)(vii) (SECURE 2.0)
    '13': 'Domestic abuse victim ($10,000 or 50% of account, lesser)',           // IRC §72(t)(2)(K) (SECURE 2.0)
    '14': 'Qualified disaster recovery ($22,000 max)',                           // IRC §72(t)(2)(J) (SECURE 2.0)
  } as Record<string, string>,
  FIRST_TIME_HOMEBUYER_LIMIT: 10000,  // IRC §72(t)(2)(F) — $10,000 lifetime limit
  BIRTH_ADOPTION_LIMIT: 5000,         // IRC §72(t)(2)(H) — $5,000 per event
};

// ──────────────────────────────────────────────────
// ACTC (Additional Child Tax Credit)
// Authority: IRC §24(d) — Refundable portion of CTC (ACTC)
// ──────────────────────────────────────────────────

export const ACTC = {
  EARNED_INCOME_THRESHOLD: 2500,    // IRC §24(d)(1)(B)(i) — 15% of earned income above $2,500
  EARNED_INCOME_RATE: 0.15,         // IRC §24(d)(1)(B)(i) — 15% rate
};

// ──────────────────────────────────────────────────
// Child and Dependent Care Credit (Form 2441)
// Authority: IRC §21 — Expenses for household and dependent care services
// Note: These amounts are NOT indexed for inflation (statutory)
// ──────────────────────────────────────────────────

export const DEPENDENT_CARE = {
  EXPENSE_LIMIT_ONE: 3000,           // IRC §21(c)(1) — $3,000 for 1 qualifying person
  EXPENSE_LIMIT_TWO_PLUS: 6000,      // IRC §21(c)(2) — $6,000 for 2+ qualifying persons
  MAX_RATE: 0.35,                    // IRC §21(a)(2) — 35% max credit rate
  MIN_RATE: 0.20,                    // IRC §21(a)(2) — 20% min credit rate (floor)
  RATE_PHASE_OUT_START: 15000,       // IRC §21(a)(2) — Rate reduces above $15k AGI
  RATE_STEP_SIZE: 2000,              // IRC §21(a)(2) — Per $2,000 increment
  RATE_STEP: 0.01,                   // IRC §21(a)(2) — 1% decrease per step
};

// ──────────────────────────────────────────────────
// Retirement Savings Contributions Credit (Saver's Credit, Form 8880)
// Authority: IRC §25B — Elective deferrals and IRA contributions by certain individuals
// Constants: Rev. Proc. 2024-40, Section 3.06 — AGI thresholds
// ──────────────────────────────────────────────────

export const SAVERS_CREDIT = {
  CONTRIBUTION_LIMIT: 2000,          // IRC §25B(a) — $2,000 max eligible contributions
  CONTRIBUTION_LIMIT_MFJ: 4000,     // IRC §25B(a) — $4,000 for MFJ/QSS
  // AGI thresholds — Rev. Proc. 2024-40 §3.06
  // Single / MFS
  SINGLE_50: 23750,                  // Notice 2024-80, §25B(b)(1)(A) — 50% rate
  SINGLE_20: 25500,                  // Notice 2024-80, §25B(b)(1)(B) — 20% rate
  SINGLE_10: 39500,                  // Notice 2024-80, §25B(b)(1)(C)/(D) — 10% rate
  // Head of Household
  HOH_50: 35625,                     // Notice 2024-80, §25B(b)(1)(A) — 50% rate
  HOH_20: 38250,                     // Notice 2024-80, §25B(b)(1)(B) — 20% rate
  HOH_10: 59250,                     // Notice 2024-80, §25B(b)(1)(C)/(D) — 10% rate
  // MFJ / QSS
  MFJ_50: 47500,                     // Notice 2024-80, §25B(b)(1)(A) — 50% rate
  MFJ_20: 51000,                     // Notice 2024-80, §25B(b)(1)(B) — 20% rate
  MFJ_10: 79000,                     // Notice 2024-80, §25B(b)(1)(C)/(D) — 10% rate
};

// ──────────────────────────────────────────────────
// Residential Clean Energy Credit (Form 5695, Part I)
// Authority: IRC §25D — Residential clean energy credit; IRA §13302 — Extended through 2034
// ──────────────────────────────────────────────────

export const CLEAN_ENERGY = {
  RATE: 0.30,                        // IRC §25D(a) — 30% credit rate (2022-2032)
  FUEL_CELL_CAP_PER_HALF_KW: 500,   // IRC §25D(b)(1)(E) — $500 per 0.5 kW capacity
};

// ──────────────────────────────────────────────────
// HSA Distributions (1099-SA)
// Authority: IRC §223(f)(2) — Includable in gross income; IRC §223(f)(4) — Additional tax
// ──────────────────────────────────────────────────

export const HSA_DISTRIBUTIONS = {
  PENALTY_RATE: 0.20,                  // IRC §223(f)(4)(A) — 20% additional tax on non-qualified
  // No penalty per IRC §223(f)(4)(C): age 65+, disabled, or death
};

// ──────────────────────────────────────────────────
// Schedule D — Capital Gains & Losses
// Authority: IRC §1211(b) — Limitation on capital losses for individuals
//           IRC §1212(b) — Capital loss carryover
// ──────────────────────────────────────────────────

export const SCHEDULE_D = {
  CAPITAL_LOSS_LIMIT: 3000,         // IRC §1211(b)(1) — $3,000 max deductible capital loss
  CAPITAL_LOSS_LIMIT_MFS: 1500,     // IRC §1211(b)(1) — $1,500 for MFS
};

// ──────────────────────────────────────────────────
// Social Security Benefits (SSA-1099)
// Authority: IRC §86 — Taxation of Social Security benefits
//           IRC §86(c) — Base amount definitions by filing status
// Note: These thresholds are NOT indexed for inflation (statutory since 1984/1993)
// ──────────────────────────────────────────────────

export const SOCIAL_SECURITY = {
  // Provisional income thresholds — IRC §86(c)(1)(A)
  SINGLE_BASE_AMOUNT: 25000,        // IRC §86(c)(1)(A)(i) — $25k (Single/HoH/QSS)
  SINGLE_ADJUSTED_BASE: 34000,      // IRC §86(b)(1) — Upper threshold for 85% tier
  // MFJ thresholds — IRC §86(c)(1)(A)(ii)
  MFJ_BASE_AMOUNT: 32000,           // IRC §86(c)(1)(A)(ii) — $32k (MFJ)
  MFJ_ADJUSTED_BASE: 44000,         // IRC §86(b)(1) — Upper threshold for 85% tier
  // MFS — IRC §86(c)(1)(C)(ii)
  MFS_BASE_AMOUNT: 0,               // IRC §86(c)(1)(C)(ii) — $0 base (always 85% taxable)
  // Taxable percentages — IRC §86(a)(1)-(2)
  RATE_50: 0.50,                     // IRC §86(a)(1) — 50% tier
  RATE_85: 0.85,                     // IRC §86(a)(2) — 85% tier
};

// ──────────────────────────────────────────────────
// Educator Expenses (Schedule 1, Line 11)
// Authority: IRC §62(a)(2)(D) — Eligible educator expenses
// Constants: Rev. Proc. 2024-40, Section 3.19 — Educator expense limit
// ──────────────────────────────────────────────────

export const EDUCATOR_EXPENSES = {
  MAX_DEDUCTION: 300,               // Rev. Proc. 2024-40 §3.19 — $300 per educator
};

// ──────────────────────────────────────────────────
// Schedule E — Rental Income
// Authority: IRC §469 — Passive activity losses and credits
//           IRC §469(i) — $25,000 special allowance for rental real estate
// Note: These amounts are NOT indexed for inflation (statutory)
// ──────────────────────────────────────────────────

export const SCHEDULE_E = {
  PASSIVE_LOSS_ALLOWANCE: 25000,     // IRC §469(i)(2) — $25k special allowance
  PHASE_OUT_START: 100000,           // IRC §469(i)(3)(A) — Phase-out begins at $100k AGI
  PHASE_OUT_RANGE: 50000,            // IRC §469(i)(3)(A) — Phase-out over $50k ($100k-$150k)
};

// ──────────────────────────────────────────────────
// Form 8582 — Passive Activity Loss Limitations
// Authority: IRC §469 — Passive activity losses and credits
//           IRC §469(i) — $25,000 special allowance for rental real estate
//           IRC §469(i)(4) — Married filing separately special rules
// Note: These amounts are NOT indexed for inflation (statutory)
// ──────────────────────────────────────────────────

export const FORM_8582 = {
  SPECIAL_ALLOWANCE: 25000,            // IRC §469(i)(2) — $25k for active participation rentals
  SPECIAL_ALLOWANCE_MFS: 12500,        // IRC §469(i)(4) — $12.5k if MFS and lived apart
  PHASE_OUT_START: 100000,             // IRC §469(i)(3)(A) — Phase-out begins
  PHASE_OUT_START_MFS: 50000,          // IRC §469(i)(4) — MFS phase-out begins at $50k
  PHASE_OUT_RANGE: 50000,              // $100k-$150k → $1 lost per $2 over
  PHASE_OUT_RANGE_MFS: 25000,          // $50k-$75k for MFS
};

// ──────────────────────────────────────────────────
// Clean Vehicle Credit (Form 8936) — EV Credit
// Authority: IRC §30D — New clean vehicle credit; IRC §25E — Previously owned clean vehicle
//           IRA §13401 — Modified §30D; IRA §13402 — New §25E
// ──────────────────────────────────────────────────

export const EV_CREDIT = {
  // New vehicle credit — IRC §30D(b)
  NEW_VEHICLE_MAX: 7500,                     // IRC §30D(b) — Up to $7,500
  NEW_CRITICAL_MINERAL: 3750,                // IRC §30D(b)(2) — $3,750 critical minerals
  NEW_BATTERY_COMPONENT: 3750,               // IRC §30D(b)(3) — $3,750 battery components
  // New vehicle MSRP caps — IRC §30D(f)(11)
  NEW_MSRP_CAP_VAN_SUV_TRUCK: 80000,        // IRC §30D(f)(11)(A) — Vans, SUVs, pickups
  NEW_MSRP_CAP_OTHER: 55000,                // IRC §30D(f)(11)(B) — Sedans, other
  // New vehicle income limits — IRC §30D(f)(10)
  NEW_INCOME_LIMIT_MFJ: 300000,             // IRC §30D(f)(10)(A) — MFJ
  NEW_INCOME_LIMIT_HOH: 225000,             // IRC §30D(f)(10)(B) — HoH
  NEW_INCOME_LIMIT_SINGLE: 150000,          // IRC §30D(f)(10)(C) — Single/MFS
  // Previously owned vehicle — IRC §25E
  USED_VEHICLE_MAX: 4000,                   // IRC §25E(a) — Up to $4,000
  USED_PRICE_CAP: 25000,                    // IRC §25E(c)(1) — Must cost ≤ $25k
  USED_INCOME_LIMIT_MFJ: 150000,            // IRC §25E(b)(1)(A) — MFJ
  USED_INCOME_LIMIT_HOH: 112500,            // IRC §25E(b)(1)(B) — HoH
  USED_INCOME_LIMIT_SINGLE: 75000,          // IRC §25E(b)(1)(C) — Single/MFS
};

// ──────────────────────────────────────────────────
// Energy Efficient Home Improvement Credit (Form 5695, Part II)
// Authority: IRC §25C — Energy efficient home improvement credit; IRA §13301 — Modified §25C
// ──────────────────────────────────────────────────

export const ENERGY_EFFICIENCY = {
  RATE: 0.30,                              // IRC §25C(a) — 30% credit rate
  AGGREGATE_ANNUAL_LIMIT: 3200,            // IRC §25C(b)(1) — $3,200 total annual
  HEAT_PUMP_ANNUAL_LIMIT: 2000,            // IRC §25C(b)(2) — $2,000 heat pump/biomass
  NON_HP_ANNUAL_LIMIT: 1200,               // IRC §25C(b)(1)(A) — $1,200 non-heat-pump
  WINDOWS_LIMIT: 600,                      // IRC §25C(b)(1)(B) — $600 windows/skylights
  DOORS_LIMIT: 500,                        // IRC §25C(b)(1)(C) — $500 exterior doors
  ELECTRICAL_PANEL_LIMIT: 600,             // IRC §25C(b)(1)(D) — $600 electrical panel
  HOME_ENERGY_AUDIT_LIMIT: 150,            // IRC §25C(b)(1)(E) — $150 home energy audit
};

// ──────────────────────────────────────────────────
// Foreign Tax Credit (Form 1116) — Simplified
// Authority: IRC §901 — Foreign tax credit; IRC §904 — Limitation on credit
//           IRC §904(j) — Certain individuals exempt from limitation ($300/$600 de minimis)
// ──────────────────────────────────────────────────

export const FOREIGN_TAX_CREDIT = {
  SIMPLIFIED_ELECTION_LIMIT: 300,          // IRC §904(j)(2)(B) — $300 de minimis (Single)
  SIMPLIFIED_ELECTION_LIMIT_MFJ: 600,     // IRC §904(j)(2)(B) — $600 de minimis (MFJ)
};

// ──────────────────────────────────────────────────
// IRC §901(j) Sanctioned Countries
// Authority: IRC §901(j) — Denial of FTC for income from sanctioned countries
// Source: OFAC SDN list / Treasury designation; IRS Rev. Rul. cross-references
// These countries are designated under IRC §901(j)(2)(A)-(C):
//   (A) Countries supporting international terrorism (IRC §6(j) EAA)
//   (B) Countries the US does not recognize / has severed diplomatic relations
//   (C) Countries where the US government has determined FTC would be contrary to US interests
// Last updated: 2025 (current OFAC designations)
// ──────────────────────────────────────────────────
export const SANCTIONED_COUNTRIES: string[] = [
  'Cuba',
  'Iran',
  'North Korea',
  'Syria',
];

// ──────────────────────────────────────────────────
// Excess Social Security Tax Credit
// Authority: IRC §31(b) — Credit for excess SS tax withheld (multiple employers)
// Constants: SSA COLA announcement, Oct 2024 — SS wage base for 2025
// ──────────────────────────────────────────────────

export const EXCESS_SS_TAX = {
  SS_TAX_RATE: 0.062,                     // IRC §3101(a) — 6.2% employee SS rate
  SS_WAGE_BASE: 176100,                    // SSA announcement — 2025 SS wage base
  MAX_SS_TAX: 10918.20,                    // 6.2% × $176,100 = $10,918.20
};

// ──────────────────────────────────────────────────
// Alimony Deduction
// Authority: IRC §215 (pre-TCJA) — Deduction for alimony payments
//           IRC §71 (pre-TCJA) — Alimony received as income
//           TCJA §11051 — Repealed §215 and §71 for post-2018 agreements
// ──────────────────────────────────────────────────

export const ALIMONY = {
  TCJA_CUTOFF_DATE: '2019-01-01',          // TCJA §11051(c) — Effective for agreements after 12/31/2018
};

// ──────────────────────────────────────────────────
// Estimated Tax Penalty (Form 2210) — 2025
// Authority: IRC §6654 — Failure to pay estimated income tax
//           IRC §6621(a)(2) — Underpayment rate
// Constants: IRS underpayment rate announcement for 2025
// ──────────────────────────────────────────────────

export const ESTIMATED_TAX_PENALTY = {
  RATE: 0.07,                           // IRC §6621(a)(2) — 7% annual rate (Q1-Q4 2025)
  REQUIRED_ANNUAL_PAYMENT_RATE: 0.90,   // IRC §6654(d)(1)(B)(ii) — 90% of current year tax
  PRIOR_YEAR_SAFE_HARBOR: 1.00,         // IRC §6654(d)(1)(B)(i) — 100% of prior year tax
  PRIOR_YEAR_SAFE_HARBOR_HIGH_INCOME: 1.10, // IRC §6654(d)(1)(C)(i) — 110% if AGI > $150k
  HIGH_INCOME_THRESHOLD: 150000,        // IRC §6654(d)(1)(C)(i) — $150k threshold
  MINIMUM_PENALTY_THRESHOLD: 1000,      // IRC §6654(e)(1) — No penalty if owed < $1,000
  // Annualized income installment method (Form 2210, Schedule AI)
  // IRC §6654(d)(2) — annualization factors
  ANNUALIZATION_FACTORS: [4, 2.4, 1.5, 1] as readonly number[],
  // IRC §6654(d)(2)(B) — required installment percentages (cumulative)
  QUARTERLY_INSTALLMENT_PERCENTAGES: [0.25, 0.50, 0.75, 1.00] as readonly number[],

  // ─── Per-Quarter Day-Count Penalty (Form 2210 Part IV) ───
  // IRC §6654(a) — penalty is simple interest on underpayment for each quarter,
  // calculated from the installment due date to the earlier of the payment date
  // or the return due date (April 15).
  //
  // Each quarter's due date and the number of days from that due date to April 15:
  //   Q1: Apr 15, 2025 → Apr 15, 2026 = 365 days
  //   Q2: Jun 15, 2025 → Apr 15, 2026 = 304 days
  //   Q3: Sep 15, 2025 → Apr 15, 2026 = 212 days
  //   Q4: Jan 15, 2026 → Apr 15, 2026 = 90 days
  //
  // Rate periods follow IRS calendar quarters (IRC §6621):
  //   P1: Apr 15 – Jun 30 (Q2 calendar quarter)
  //   P2: Jul 1 – Sep 30 (Q3 calendar quarter)
  //   P3: Oct 1 – Dec 31 (Q4 calendar quarter)
  //   P4: Jan 1 – Apr 15 (Q1 calendar quarter, extended to filing date)
  //
  // For TY2025, all four rate periods use 7% (federal short-term rate 4% + 3%).
  // These are stored as per-period rates so future years with split rates are easy to update.
  //
  // Day-count matrix: row = installment quarter, col = rate period
  // Each cell = days the underpayment accrues interest in that rate period.
  // Penalty per cell = underpayment × rate × days / 365
  DAYS_MATRIX: [
    [77, 92, 92, 104],  // Q1: Apr 15→Jun 30(77d), Jul 1→Sep 30(92d), Oct 1→Dec 31(92d), Jan 1→Apr 15(104d) = 365
    [16, 92, 92, 104],  // Q2: Jun 15→Jun 30(16d), Jul 1→Sep 30(92d), Oct 1→Dec 31(92d), Jan 1→Apr 15(104d) = 304
    [0,  16, 92, 104],  // Q3: Sep 15→Sep 30(16d), Oct 1→Dec 31(92d), Jan 1→Apr 15(104d) = 212
    [0,   0,  0,  90],  // Q4: Jan 15→Apr 15(90d)
  ] as readonly (readonly number[])[],
  // Annual underpayment rate for each rate period (IRC §6621(a)(2))
  // TY2025: all periods = 7% (federal short-term rate rounded up + 3%)
  // Per Rev. Rul. 2024-22, Rev. Rul. 2025-02 (adjusted quarterly by IRS)
  PERIOD_RATES: [0.07, 0.07, 0.07, 0.07] as readonly number[],
};

// ──────────────────────────────────────────────────
// Kiddie Tax (Form 8615) — 2025
// Authority: IRC §1(g) — Certain unearned income of children taxed at parent's rate
// Constants: Rev. Proc. 2024-40, Section 3.03 — Kiddie tax thresholds
// ──────────────────────────────────────────────────

export const KIDDIE_TAX = {
  UNEARNED_INCOME_THRESHOLD: 2700,     // Rev. Proc. 2024-40 §3.03 — 2× $1,350 threshold
  STANDARD_DEDUCTION_UNEARNED: 1350,   // Rev. Proc. 2024-40 §3.03 — $1,350 per tier
  AGE_LIMIT: 19,                        // IRC §1(g)(2)(A)(i) — Under 19
  STUDENT_AGE_LIMIT: 24,               // IRC §1(g)(2)(A)(ii)(II) — Under 24 if student
};

// ──────────────────────────────────────────────────
// Foreign Earned Income Exclusion (Form 2555) — 2025
// Authority: IRC §911 — Citizens or residents living abroad
// Constants: Rev. Proc. 2024-40, Section 3.36 — FEIE exclusion amount
// ──────────────────────────────────────────────────

export const FEIE = {
  EXCLUSION_AMOUNT: 130000,             // Rev. Proc. 2024-40 §3.36 — $130,000 max exclusion
  HOUSING_BASE: 20280,                  // IRC §911(c)(1)(B) — 16% of exclusion ($130k × 0.156)
  HOUSING_MAX_EXCLUSION: 39000,         // IRC §911(c)(2)(A) — 30% of exclusion ($130k × 0.30)
};

// ──────────────────────────────────────────────────
// Schedule H — Household Employee Tax (2025)
// Authority: IRC §3111 — Employer FICA; IRC §3301 — FUTA tax
//           IRC §3121(x) — Domestic service employment threshold
// Constants: SSA announcement — Household employee cash wage threshold
// ──────────────────────────────────────────────────

export const SCHEDULE_H = {
  CASH_WAGE_THRESHOLD: 2800,            // IRC §3121(x), SSA 2025 — SS/Medicare threshold
  FUTA_WAGE_THRESHOLD: 1000,            // IRC §3306(a)(3) — FUTA quarterly threshold
  SS_RATE: 0.124,                       // IRC §§3111(a)+3101(a) — Combined employer+employee SS rate (6.2% × 2)
  MEDICARE_RATE: 0.029,                 // IRC §§3111(b)+3101(b) — Combined employer+employee Medicare rate (1.45% × 2)
  FUTA_RATE: 0.006,                     // IRC §3301 — 6.0% gross, 5.4% state credit = 0.6% net
  FUTA_WAGE_BASE: 7000,                 // IRC §3306(b)(1) — First $7,000 per employee
  SS_WAGE_BASE: 176100,                 // SSA COLA announcement, Oct 2024 — 2025 SS wage base
};

// ──────────────────────────────────────────────────
// Net Operating Loss (NOL) Carryforward — TCJA Rules
// Authority: IRC §172(a) — NOL deduction; IRC §172(b)(2) — 80% limitation
//           TCJA §13302 — Modified NOL rules (no carryback, 80% limit)
// ──────────────────────────────────────────────────

export const NOL = {
  DEDUCTION_LIMIT_RATE: 0.80,                // IRC §172(a)(2) — 80% of taxable income limit (post-2020)
};

// ──────────────────────────────────────────────────
// Adoption Credit (Form 8839) — 2025
// Authority: IRC §23 — Adoption expenses credit
// Constants: Rev. Proc. 2024-40, Section 3.35 — Adoption credit limits
// ──────────────────────────────────────────────────

export const ADOPTION_CREDIT = {
  MAX_CREDIT: 17280,                    // Rev. Proc. 2024-40 §3.35 — Max per child
  PHASE_OUT_START: 259190,              // Rev. Proc. 2024-40 §3.35 — AGI phase-out start
  PHASE_OUT_RANGE: 40000,              // IRC §23(b)(2)(A)(i) — $40k phase-out range
};

// ──────────────────────────────────────────────────
// Dependent Care FSA Coordination
// Authority: IRC §129 — Dependent care assistance programs
// ──────────────────────────────────────────────────

export const DEPENDENT_CARE_FSA = {
  MAX_EXCLUSION: 5000,                       // IRC §129(a)(2)(A) — $5,000 max exclusion
  MAX_EXCLUSION_MFS: 2500,                   // IRC §129(a)(2)(B) — $2,500 if MFS
};

// ──────────────────────────────────────────────────
// Premium Tax Credit (Form 8962) — 2025
// Authority: IRC §36B — Refundable credit for coverage under qualified health plan
//           ACA §1401 — Original PTC; IRA §12001 — Extended enhanced subsidies through 2025
// Constants: HHS 2024 Federal Poverty Guidelines (used for TY2025)
//           Rev. Proc. 2024-35 — Applicable figure table
//           Rev. Proc. 2024-40, Table 5 — Repayment caps
// ──────────────────────────────────────────────────

export const PREMIUM_TAX_CREDIT = {
  // Federal Poverty Level — HHS 2024 guidelines (89 FR 3936), used for TY2025
  // 48 contiguous states + DC
  FPL_BASE_48: 15060,                         // HHS 2024 FPL — Family size 1 (48 states + DC)
  FPL_INCREMENT_48: 5380,                     // HHS 2024 FPL — Per additional person
  // Alaska
  FPL_BASE_AK: 18810,                        // HHS 2024 FPL — Alaska family size 1
  FPL_INCREMENT_AK: 6730,                    // HHS 2024 FPL — Alaska per additional person
  // Hawaii
  FPL_BASE_HI: 17310,                        // HHS 2024 FPL — Hawaii family size 1
  FPL_INCREMENT_HI: 6190,                    // HHS 2024 FPL — Hawaii per additional person

  // Applicable Figure Table — Rev. Proc. 2024-35
  // Enhanced ARP/IRA rates for 2025 — IRC §36B(b)(3)(A), IRA §12001
  // [fplFloor, fplCeiling, initialPct, finalPct]
  APPLICABLE_FIGURE_TABLE: [
    { floor: 0, ceiling: 150, initialPct: 0, finalPct: 0 },
    { floor: 150, ceiling: 200, initialPct: 0, finalPct: 0.02 },
    { floor: 200, ceiling: 250, initialPct: 0.02, finalPct: 0.04 },
    { floor: 250, ceiling: 300, initialPct: 0.04, finalPct: 0.06 },
    { floor: 300, ceiling: 400, initialPct: 0.06, finalPct: 0.085 },
    { floor: 400, ceiling: Infinity, initialPct: 0.085, finalPct: 0.085 },
  ] as const,

  // Minimum FPL percentage — IRC §36B(c)(1)(A)
  MIN_FPL_PERCENTAGE: 100,

  // Excess APTC Repayment Caps — Rev. Proc. 2024-40, Table 5; IRC §36B(f)(2)(B)
  REPAYMENT_CAPS: [
    { floor: 0, ceiling: 200, singleCap: 375, otherCap: 750 },     // Rev. Proc. 2024-40 Table 5
    { floor: 200, ceiling: 300, singleCap: 975, otherCap: 1950 },   // Rev. Proc. 2024-40 Table 5
    { floor: 300, ceiling: 400, singleCap: 1625, otherCap: 3250 },  // Rev. Proc. 2024-40 Table 5
    // 400%+ FPL: no cap (full repayment) — IRC §36B(f)(2)(A)
  ] as const,
};

// ──────────────────────────────────────────────────
// Schedule 1-A — Additional Deductions (OBBBA 2025-2028)
// Authority: One Big Beautiful Bill Act (OBBBA), signed 2025
//           OBBBA §101 — No Tax on Tips; OBBBA §102 — No Tax on Overtime
//           OBBBA §103 — Car Loan Interest; OBBBA §104 — Enhanced Senior Deduction
// Note: Below-the-line deductions (reduce taxable income, not AGI). Effective 2025-2028.
// ──────────────────────────────────────────────────

export const SCHEDULE_1A = {
  // No Tax on Tips — OBBBA §101
  TIPS_CAP: 25000,                         // OBBBA §101(a) — $25k cap per return
  TIPS_PHASE_OUT_SINGLE: 150000,           // OBBBA §101(b) — Single/HOH phase-out start
  TIPS_PHASE_OUT_MFJ: 300000,             // OBBBA §101(b) — MFJ phase-out start
  TIPS_PHASE_OUT_RATE: 100,               // OBBBA §101(b) — $100 per $1k excess (floor)
  TIPS_PHASE_OUT_STEP: 1000,

  // No Tax on Overtime — OBBBA §102
  OVERTIME_CAP_SINGLE: 12500,              // OBBBA §102(a) — $12.5k (Single, HOH)
  OVERTIME_CAP_MFJ: 25000,                // OBBBA §102(a) — $25k (MFJ)
  OVERTIME_PHASE_OUT_SINGLE: 150000,       // OBBBA §102(b) — Single/HOH phase-out start
  OVERTIME_PHASE_OUT_MFJ: 300000,         // OBBBA §102(b) — MFJ phase-out start
  OVERTIME_PHASE_OUT_RATE: 100,            // OBBBA §102(b) — $100 per $1k excess (floor)
  OVERTIME_PHASE_OUT_STEP: 1000,

  // No Tax on Car Loan Interest — OBBBA §103
  CAR_LOAN_CAP: 10000,                    // OBBBA §103(a) — $10k cap per return
  CAR_LOAN_PHASE_OUT_SINGLE: 100000,      // OBBBA §103(b) — Single/HOH/MFS phase-out start
  CAR_LOAN_PHASE_OUT_MFJ: 200000,        // OBBBA §103(b) — MFJ phase-out start
  CAR_LOAN_PHASE_OUT_RATE: 200,           // OBBBA §103(b) — $200 per $1k excess (ceiling)
  CAR_LOAN_PHASE_OUT_STEP: 1000,

  // Enhanced Senior Deduction — OBBBA §104
  SENIOR_AMOUNT: 6000,                    // OBBBA §104(a) — $6k per qualifying individual (65+)
  SENIOR_PHASE_OUT_SINGLE: 75000,          // OBBBA §104(b) — Single/HOH phase-out start
  SENIOR_PHASE_OUT_MFJ: 150000,           // OBBBA §104(b) — MFJ phase-out start
  SENIOR_PHASE_OUT_RATE: 0.06,            // OBBBA §104(b) — 6% of excess MAGI
};

// ──────────────────────────────────────────────────
// Sale of Home Exclusion (Section 121)
// Authority: IRC §121 — Exclusion of gain from sale of principal residence
// ──────────────────────────────────────────────────

export const HOME_SALE_EXCLUSION = {
  SINGLE_MAX: 250000,                     // IRC §121(b)(1) — $250k exclusion
  MFJ_MAX: 500000,                        // IRC §121(b)(2)(A) — $500k exclusion (MFJ)
  OWNERSHIP_MONTHS_REQUIRED: 24,          // IRC §121(a) — 2 of last 5 years owned
  RESIDENCE_MONTHS_REQUIRED: 24,          // IRC §121(a) — 2 of last 5 years resided
};

// ──────────────────────────────────────────────────
// Charitable Contribution AGI Limits (Schedule A)
// Authority: IRC §170(b)(1) — Percentage limitations on charitable deductions
// ──────────────────────────────────────────────────

export const CHARITABLE_AGI_LIMITS = {
  CASH_PUBLIC_RATE: 0.60,                 // IRC §170(b)(1)(G) — 60% AGI for cash to public charities
  NON_CASH_RATE: 0.30,                    // IRC §170(b)(1)(C) — 30% AGI for capital gain property
  NON_CASH_ORDINARY_RATE: 0.50,           // IRC §170(b)(1)(A) — 50% AGI for ordinary income property
  OVERALL_LIMIT_RATE: 0.60,              // IRC §170(b)(1)(G) — 60% overall charitable AGI limit
};

// ──────────────────────────────────────────────────
// Form 8283 — Non-Cash Charitable Contributions
// Authority: IRC §170(f)(11) — Substantiation requirements for noncash donations
//           Reg §1.170A-13 — Recordkeeping and return requirements
// ──────────────────────────────────────────────────

export const FORM_8283 = {
  SECTION_B_THRESHOLD: 5000,              // Items > $5,000 require Section B (qualified appraisal)
  CARRYFORWARD_YEARS: 5,                  // IRC §170(d)(1) — 5-year carryforward for excess donations
};

// ──────────────────────────────────────────────────
// Cancellation of Debt (1099-C / Form 982)
// Authority: IRC §61(a)(11) — COD as gross income; IRC §108 — Exclusions
//           IRC §6050P — Information returns for cancelled debt
// ──────────────────────────────────────────────────

export const CANCELLATION_OF_DEBT = {
  MIN_REPORTING_AMOUNT: 600,           // IRC §6050P(a) — $600 reporting threshold
};

// ──────────────────────────────────────────────────
// Excess Contribution Penalties (Form 5329)
// Authority: IRC §4973(a) — 6% excise on excess IRA contributions
//           IRC §4973(g) — 6% excise on excess HSA contributions
// ──────────────────────────────────────────────────

export const EXCESS_CONTRIBUTION = {
  PENALTY_RATE: 0.06,                   // IRC §4973(a), (g), (e) — 6% excise tax rate
};

// Coverdell ESA Contribution Limit
// Authority: IRC §530(b)(1)(A)(iii) — $2,000 annual limit per beneficiary
export const ESA_CONTRIBUTION_LIMIT = 2000;

// ──────────────────────────────────────────────────
// Scholarship Granting Organization Credit (IRC §25F)
// Authority: OBBBA §70202 — Credit for contributions to qualified SGOs
//           Notice 2025-70 — Interim guidance on §25F
//           Rev. Proc. 2026-6 — State election procedures for SGO participation
// ──────────────────────────────────────────────────

export const SCHOLARSHIP_CREDIT = {
  MAX_CREDIT: 1700,                     // IRC §25F(a) — $1,700 max per return
};

// ──────────────────────────────────────────────────
// SECURE 2.0 Emergency Personal Expense Distribution
// Authority: SECURE 2.0 Act §314 — IRC §72(t)(2)(I)
//           Notice 2026-13 — Safe harbor rollover explanations
// Note: Distributions after 12/31/2023 for emergency personal expenses
//       are exempt from the 10% early withdrawal penalty, up to $1,000/year.
// ──────────────────────────────────────────────────

export const EMERGENCY_DISTRIBUTION = {
  ANNUAL_LIMIT: 1000,                   // IRC §72(t)(2)(I)(ii) — $1,000 annual cap
  REPAYMENT_PERIOD_YEARS: 3,            // IRC §72(t)(2)(I)(iv) — 3-year repayment window
};

// ──────────────────────────────────────────────────
// 1099-Q (529 Distributions)
// Authority: IRC §529(c)(3)(A) — Qualified distributions tax-free
//           IRC §529(c)(6) — 10% additional tax on non-qualified distributions
// ──────────────────────────────────────────────────

export const DISTRIBUTION_529 = {
  PENALTY_RATE: 0.10,                   // IRC §529(c)(6) — 10% additional tax on earnings
};

// ──────────────────────────────────────────────────
// Qualified Opportunity Zone (Form 8997)
// Authority: IRC §1400Z-2 — Special rules for capital gains invested in QOZ funds
//           TCJA §13823 — Opportunity Zone program
// ──────────────────────────────────────────────────

export const QOZ = {
  DEFERRAL_PERIOD_5_YEAR_STEP_UP: 0.10,  // IRC §1400Z-2(b)(2)(B)(iii) — 10% basis step-up after 5 years
  DEFERRAL_PERIOD_7_YEAR_STEP_UP: 0.15,  // IRC §1400Z-2(b)(2)(B)(iv) — 15% step-up after 7 years (expired)
};

// ──────────────────────────────────────────────────
// Form 4137 — Social Security and Medicare Tax on Unreported Tip Income
// Authority: IRC §3121(q) — Tips treated as wages; IRC §3101 — Employee FICA rates
// Constants: SSA announcement — SS wage base for 2025
// ──────────────────────────────────────────────────

export const FORM_4137 = {
  SS_RATE: 0.062,                         // IRC §3101(a) — Employee Social Security rate (6.2%)
  MEDICARE_RATE: 0.0145,                  // IRC §3101(b)(1) — Employee Medicare rate (1.45%)
  SS_WAGE_BASE: 176100,                   // SSA announcement — 2025 Social Security wage base
};

// ──────────────────────────────────────────────────
// Dependent Care Employer Benefits (Form 2441, Part III)
// Authority: IRC §129 — Dependent care assistance programs
// ──────────────────────────────────────────────────

export const DEPENDENT_CARE_EMPLOYER = {
  MAX_EXCLUSION: 5000,                     // IRC §129(a)(2)(A) — $5,000 max exclusion
  MAX_EXCLUSION_MFS: 2500,                 // IRC §129(a)(2)(B) — $2,500 if MFS
  STUDENT_DISABLED_DEEMED_ONE: 250,        // IRC §21(d)(2) — $250/month deemed income (one qualifying person)
  STUDENT_DISABLED_DEEMED_TWO: 500,        // IRC §21(d)(2) — $500/month deemed income (two+ qualifying persons)
};

// ──────────────────────────────────────────────────
// EV Refueling Property Credit (Form 8911)
// Authority: IRC §30C — Alternative fuel vehicle refueling property credit
//           IRA §13404 — Extension and modification (through 2032)
// Constants: Statutory amounts (not inflation-indexed)
// ──────────────────────────────────────────────────

// ──────────────────────────────────────────────────
// Schedule R — Credit for the Elderly or the Disabled (2025)
// Authority: IRC §22 — Credit for the elderly and the permanently and totally disabled
// Note: ALL amounts are statutory (IRC §22) and NOT indexed for inflation
// ──────────────────────────────────────────────────

export const SCHEDULE_R = {
  // Initial amounts — IRC §22(c)(2)
  INITIAL_AMOUNT_SINGLE: 5000,               // IRC §22(c)(2)(A) — Single, HoH, QSS
  INITIAL_AMOUNT_MFJ_BOTH: 7500,             // IRC §22(c)(2)(B)(i) — MFJ, both qualifying
  INITIAL_AMOUNT_MFJ_ONE: 5000,              // IRC §22(c)(2)(B)(ii) — MFJ, one qualifying
  INITIAL_AMOUNT_MFS: 3750,                  // IRC §22(c)(2)(C) — MFS (must live apart)
  // AGI thresholds — IRC §22(d)
  AGI_THRESHOLD_SINGLE: 7500,                // IRC §22(d)(1)(A) — Single, HoH, QSS
  AGI_THRESHOLD_MFJ: 10000,                  // IRC §22(d)(1)(B) — MFJ
  AGI_THRESHOLD_MFS: 5000,                   // IRC §22(d)(1)(C) — MFS
  // Reduction rate — IRC §22(d)
  AGI_REDUCTION_RATE: 0.50,                  // IRC §22(d) — 50% of excess AGI
  // Credit rate — IRC §22(a)
  CREDIT_RATE: 0.15,                         // IRC §22(a) — 15% of base amount
};

// ──────────────────────────────────────────────────
// Solo 401(k) — Defined Contribution Limits (2025)
// Authority: IRC §402(g) — Elective deferral limit
//           IRC §414(v) — Catch-up contributions for age 50+
//           IRC §414(v)(2)(E) — Super catch-up for ages 60-63 (SECURE 2.0 Act §109)
//           IRC §415(c) — Annual additions limit
//           IRC §401(a)(17) — Compensation cap
// Constants: IRS Notice 2024-80 — 2025 retirement plan limits
// ──────────────────────────────────────────────────

export const SOLO_401K = {
  EMPLOYEE_DEFERRAL_LIMIT: 23500,          // IRC §402(g)(1) — 2025 elective deferral limit
  CATCH_UP_50_PLUS: 7500,                  // IRC §414(v)(2)(B)(i) — Age 50+ catch-up ($7,500 for 2025)
  SUPER_CATCH_UP_60_63: 11250,             // IRC §414(v)(2)(E) — Ages 60-63 super catch-up (SECURE 2.0, $11,250 for 2025)
  EMPLOYER_CONTRIBUTION_RATE: 0.25,         // IRC §404(a)(8)(C) — 25% of compensation
  // For self-employed: effective rate is ~20% due to circular calculation
  // IRC §401(d)(1): net SE earnings reduced by the contribution itself
  // IRS Publication 560, Rate Table: 0.25 / 1.25 = 0.20 effective rate
  SE_EFFECTIVE_RATE: 0.20,                  // IRS Pub 560 — Self-employed effective contribution rate
  ANNUAL_ADDITION_LIMIT: 70000,             // IRC §415(c)(1)(A) — 2025 total annual additions limit
  COMPENSATION_CAP: 350000,                 // IRC §401(a)(17) — 2025 compensation cap for calculations
};

// ──────────────────────────────────────────────────
// SEP-IRA Contribution Limits (2025)
// Authority: IRC §408(k) — SEP requirements; IRC §402(h) — Contribution limits
//           IRC §404(h)(1)(C) — 25% of compensation
// Constants: IRS Notice 2024-80 — 2025 retirement plan limits
// ──────────────────────────────────────────────────

export const SEP_IRA = {
  CONTRIBUTION_RATE: 0.25,                  // IRC §404(h)(1)(C) — 25% of compensation
  SE_EFFECTIVE_RATE: 0.20,                  // IRS Pub 560 — Self-employed effective rate (25%/125%)
  MAX_CONTRIBUTION: 70000,                  // IRC §402(h)(2) — 2025 max SEP-IRA contribution ($70,000)
  COMPENSATION_CAP: 350000,                 // IRC §401(a)(17) — 2025 compensation cap
};

// ──────────────────────────────────────────────────
// SIMPLE IRA Contribution Limits (2025)
// Authority: IRC §408(p)(2)(A) — Elective deferral limit for SIMPLE plans
//           IRC §414(v)(2)(B)(ii) — SIMPLE catch-up ($3,500 for 2025)
//           IRC §414(v)(2)(E) — SECURE 2.0 super catch-up ($5,250 for ages 60-63)
// Constants: IRS Notice 2024-80 — 2025 retirement plan limits
// ──────────────────────────────────────────────────

export const SIMPLE_IRA = {
  EMPLOYEE_DEFERRAL_LIMIT: 16500,          // IRC §408(p)(2)(A)(ii) — 2025 SIMPLE elective deferral limit
  CATCH_UP_50_PLUS: 3500,                  // IRC §414(v)(2)(B)(ii) — Age 50+ catch-up for SIMPLE ($3,500 for 2025)
  SUPER_CATCH_UP_60_63: 5250,             // IRC §414(v)(2)(E) — Ages 60-63 super catch-up (SECURE 2.0, $5,250 for 2025)
  EMPLOYER_MATCH_RATE: 0.03,               // IRC §408(p)(2)(B)(i) — Dollar-for-dollar match up to 3% of compensation
  EMPLOYER_NONELECTIVE_RATE: 0.02,         // IRC §408(p)(2)(B)(ii) — Alternative: 2% of compensation for all eligible employees
};

// ──────────────────────────────────────────────────
// Long-Term Care Premium Limits — IRC §213(d)(10)
// Authority: Rev. Proc. 2024-40 (2025 inflation-adjusted amounts)
// Source: https://apps.irs.gov/app/vita/content/00/00_25_005.jsp
// Per person. Used by Form 7206 to cap deductible LTC premiums by age.
// ──────────────────────────────────────────────────
export const LTC_PREMIUM_LIMITS_2025 = {
  AGE_40_OR_UNDER: 480,
  AGE_41_TO_50: 900,
  AGE_51_TO_60: 1800,
  AGE_61_TO_70: 4810,
  AGE_71_AND_OVER: 6020,
} as const;

export const EV_REFUELING = {
  CREDIT_RATE: 0.30,                   // IRC §30C(a) — 30% of cost
  PERSONAL_CAP: 1000,                  // IRC §30C(e)(1) — $1,000 per property (personal use)
  BUSINESS_CAP: 100000,               // IRC §30C(e)(2) — $100,000 per property (business use)
};

// ──────────────────────────────────────────────────
// Plausibility Thresholds — WARN-level validations
// Inspired by IRS Direct File Fact Graph's distinction between
// ERROR (blocks submission) and WARN (flags implausibility).
//
// These are NOT legal limits. They flag values that seem unusual and
// should be double-checked by the filer. They never block calculation.
//
// Thresholds based on IRS audit trigger research and SOI statistical norms.
// ──────────────────────────────────────────────────

export const PLAUSIBILITY = {
  // Income thresholds (absolute dollar amounts)
  W2_WAGES_HIGH: 1_000_000,              // Single W-2 wages > $1M is unusual
  SELF_EMPLOYMENT_INCOME_HIGH: 500_000,   // Single 1099-NEC > $500K
  INTEREST_INCOME_HIGH: 100_000,          // Single 1099-INT > $100K
  DIVIDEND_INCOME_HIGH: 200_000,          // Single 1099-DIV ordinary dividends > $200K
  RETIREMENT_DISTRIBUTION_HIGH: 500_000,  // Single 1099-R > $500K

  // Deduction thresholds (as fraction of AGI)
  CHARITABLE_CASH_AGI_RATE: 0.50,         // Cash donations > 50% of AGI
  MEDICAL_AGI_RATE: 0.30,                 // Medical expenses > 30% of AGI

  // Deduction thresholds (absolute)
  SALT_ENTERED_HIGH: 50_000,              // Total SALT entered > $50K (cap is $40K/$20K MFS)

  // Home office
  HOME_OFFICE_AREA_PCT: 0.50,             // Home office > 50% of total home area

  // Vehicle
  VEHICLE_BUSINESS_MILES_HIGH: 40_000,    // Business miles > 40K per year
};
