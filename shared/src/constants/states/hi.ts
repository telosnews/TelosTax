/**
 * Hawaii State Tax Constants — Tax Year 2025
 *
 * Sources:
 *   - HRS §235-51 — Hawaii income tax rates
 *   - HRS §235-54 — Personal exemptions
 *   - HRS §235-55.85 — Food/excise tax credit ($220/exemption, doubled by HB 2404)
 *   - HRS §235-110.91 — Hawaii EITC (40% of federal, doubled by HB 2404)
 *   - Hawaii Form N-11 — Individual Income Tax Return (Resident)
 *
 * Key Hawaii characteristics:
 *   - 12 progressive brackets (most in the US), top rate 11%
 *   - Filing-status-specific brackets (Single vs MFJ differ)
 *   - Social Security benefits fully exempt
 *   - Refundable food/excise tax credit ($220 per exemption, HB 2404)
 *   - State EITC: 40% of federal EITC (refundable, HB 2404)
 */

import { StateTaxBracket } from '../../types/index.js';

// ─── HI Income Tax Brackets (2025) ──────────────────────────────
// 12 progressive brackets — most in the nation

export const HI_BRACKETS: Record<string, StateTaxBracket[]> = {
  single: [
    { min: 0,       max: 9600,     rate: 0.014 },
    { min: 9600,    max: 14400,    rate: 0.032 },
    { min: 14400,   max: 19200,    rate: 0.055 },
    { min: 19200,   max: 24000,    rate: 0.064 },
    { min: 24000,   max: 36000,    rate: 0.068 },
    { min: 36000,   max: 48000,    rate: 0.072 },
    { min: 48000,   max: 125000,   rate: 0.076 },
    { min: 125000,  max: 175000,   rate: 0.079 },
    { min: 175000,  max: 225000,   rate: 0.0825 },
    { min: 225000,  max: 275000,   rate: 0.09 },
    { min: 275000,  max: 325000,   rate: 0.10 },
    { min: 325000,  max: Infinity,  rate: 0.11 },
  ],
  married_joint: [
    { min: 0,       max: 19200,    rate: 0.014 },
    { min: 19200,   max: 28800,    rate: 0.032 },
    { min: 28800,   max: 38400,    rate: 0.055 },
    { min: 38400,   max: 48000,    rate: 0.064 },
    { min: 48000,   max: 72000,    rate: 0.068 },
    { min: 72000,   max: 96000,    rate: 0.072 },
    { min: 96000,   max: 250000,   rate: 0.076 },
    { min: 250000,  max: 350000,   rate: 0.079 },
    { min: 350000,  max: 450000,   rate: 0.0825 },
    { min: 450000,  max: 550000,   rate: 0.09 },
    { min: 550000,  max: 650000,   rate: 0.10 },
    { min: 650000,  max: Infinity,  rate: 0.11 },
  ],
  married_separate: [
    { min: 0,       max: 9600,     rate: 0.014 },
    { min: 9600,    max: 14400,    rate: 0.032 },
    { min: 14400,   max: 19200,    rate: 0.055 },
    { min: 19200,   max: 24000,    rate: 0.064 },
    { min: 24000,   max: 36000,    rate: 0.068 },
    { min: 36000,   max: 48000,    rate: 0.072 },
    { min: 48000,   max: 125000,   rate: 0.076 },
    { min: 125000,  max: 175000,   rate: 0.079 },
    { min: 175000,  max: 225000,   rate: 0.0825 },
    { min: 225000,  max: 275000,   rate: 0.09 },
    { min: 275000,  max: 325000,   rate: 0.10 },
    { min: 325000,  max: Infinity,  rate: 0.11 },
  ],
  head_of_household: [
    { min: 0,       max: 14400,    rate: 0.014 },
    { min: 14400,   max: 21600,    rate: 0.032 },
    { min: 21600,   max: 28800,    rate: 0.055 },
    { min: 28800,   max: 36000,    rate: 0.064 },
    { min: 36000,   max: 54000,    rate: 0.068 },
    { min: 54000,   max: 72000,    rate: 0.072 },
    { min: 72000,   max: 187500,   rate: 0.076 },
    { min: 187500,  max: 262500,   rate: 0.079 },
    { min: 262500,  max: 337500,   rate: 0.0825 },
    { min: 337500,  max: 412500,   rate: 0.09 },
    { min: 412500,  max: 487500,   rate: 0.10 },
    { min: 487500,  max: Infinity,  rate: 0.11 },
  ],
};

// ─── HI Standard Deduction (2025) ───────────────────────────────
export const HI_STANDARD_DEDUCTION: Record<string, number> = {
  single: 4400,
  married_joint: 8800,
  married_separate: 4400,
  head_of_household: 6424,
};

// ─── HI Personal Exemption (2025) ──────────────────────────────
// $1,144 per exemption (taxpayer, spouse if MFJ, each dependent)
export const HI_PERSONAL_EXEMPTION = 1144;

// ─── HI Dependent Exemption (2025) ─────────────────────────────
// $1,144 per dependent (same amount as personal exemption)
export const HI_DEPENDENT_EXEMPTION = 1144;

// ─── HI Food/Excise Tax Credit (AGI Sliding Scale) ───────────
// Refundable credit per qualified exemption, phased down by AGI.
// HRS §235-55.85 — HB 2404 doubled max to $220 for TY2025.
// Source: 2025 HI Form N-311 instructions
//
// Single filers: 5 tiers + $0 at $40K+
// All other filers (MFJ/MFS/HoH/QSS): 7 tiers + $0 at $60K+
// AGI is federal AGI (for MFS: combined spousal AGI).

export interface HIFoodCreditTier {
  maxAGI: number;   // Upper bound (exclusive) — credit applies when AGI < this
  credit: number;    // Credit per qualified exemption
}

export const HI_FOOD_CREDIT_SINGLE: HIFoodCreditTier[] = [
  { maxAGI: 15000,    credit: 220 },
  { maxAGI: 20000,    credit: 200 },
  { maxAGI: 25000,    credit: 170 },
  { maxAGI: 30000,    credit: 140 },
  { maxAGI: 40000,    credit: 110 },
  // $40,000+ → $0 (not eligible)
];

export const HI_FOOD_CREDIT_OTHER: HIFoodCreditTier[] = [
  { maxAGI: 15000,    credit: 220 },
  { maxAGI: 20000,    credit: 200 },
  { maxAGI: 25000,    credit: 170 },
  { maxAGI: 30000,    credit: 140 },
  { maxAGI: 40000,    credit: 110 },
  { maxAGI: 50000,    credit: 90 },
  { maxAGI: 60000,    credit: 70 },
  // $60,000+ → $0 (not eligible)
];

// Legacy constant kept for reference — the maximum credit per exemption
export const HI_FOOD_EXCISE_CREDIT_PER_EXEMPTION = 220;

// ─── HI EITC (2025) ───────────────────────────────────────────
// Hawaii EITC is 40% of federal EITC (HRS §235-110.91, doubled by HB 2404 for TY2025)
// Refundable credit
// Source: 2025 HI N-356 instructions
export const HI_EITC_MATCH_RATE = 0.40;
