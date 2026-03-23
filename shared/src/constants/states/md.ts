/**
 * Maryland State Tax Constants — Tax Year 2025
 *
 * Sources:
 *   - MD Tax-General Article §10-105 — Maryland income tax rates
 *   - MD Tax-General Article §10-207 — Standard deduction
 *   - MD Tax-General Article §10-211 — Personal exemptions
 *   - Comptroller of Maryland — County income tax rates (TY2025)
 *   - MD Form 502 — Maryland Resident Income Tax Return
 */

import { StateTaxBracket } from '../../types/index.js';

// ─── MD Income Tax Brackets (2025) ──────────────────────────────
// 10 progressive brackets. HB 352 (2024, effective TY2025+):
//   - Added 6.25% and 6.50% top brackets
//   - Brackets 5+ differ by filing status: Single/MFS vs MFJ/HoH/QSS
// Source: PolicyEngine (cites MD HB 352 §161)

const MD_BRACKETS_SINGLE: StateTaxBracket[] = [
  { min: 0,       max: 1000,      rate: 0.02 },
  { min: 1000,    max: 2000,      rate: 0.03 },
  { min: 2000,    max: 3000,      rate: 0.04 },
  { min: 3000,    max: 100000,    rate: 0.0475 },
  { min: 100000,  max: 125000,    rate: 0.05 },
  { min: 125000,  max: 150000,    rate: 0.0525 },
  { min: 150000,  max: 250000,    rate: 0.055 },
  { min: 250000,  max: 500000,    rate: 0.0575 },
  { min: 500000,  max: 1000000,   rate: 0.0625 },
  { min: 1000000, max: Infinity,  rate: 0.065 },
];

const MD_BRACKETS_JOINT: StateTaxBracket[] = [
  { min: 0,       max: 1000,      rate: 0.02 },
  { min: 1000,    max: 2000,      rate: 0.03 },
  { min: 2000,    max: 3000,      rate: 0.04 },
  { min: 3000,    max: 150000,    rate: 0.0475 },
  { min: 150000,  max: 175000,    rate: 0.05 },
  { min: 175000,  max: 225000,    rate: 0.0525 },
  { min: 225000,  max: 300000,    rate: 0.055 },
  { min: 300000,  max: 600000,    rate: 0.0575 },
  { min: 600000,  max: 1200000,   rate: 0.0625 },
  { min: 1200000, max: Infinity,  rate: 0.065 },
];

export const MD_BRACKETS: Record<string, StateTaxBracket[]> = {
  single: MD_BRACKETS_SINGLE,
  married_joint: MD_BRACKETS_JOINT,
  married_separate: MD_BRACKETS_SINGLE,
  head_of_household: MD_BRACKETS_JOINT,
};

// ─── MD Standard Deduction (2025) ───────────────────────────────
// HB 352 replaced the 15%-of-AGI formula with flat amounts for TY2025+.
// Source: PolicyEngine (cites MD HB 352 pp.164-165)
export const MD_STANDARD_DEDUCTION: Record<string, number> = {
  single: 3350,
  married_joint: 6700,
  married_separate: 3350,
  head_of_household: 6700,
};

// ─── MD Personal Exemption (2025) ───────────────────────────────
// $3,200 per person: taxpayer, spouse (if MFJ), and each dependent.
// Phases out for higher-income filers.
export const MD_PERSONAL_EXEMPTION = 3200;

// Phaseout thresholds — exemption reduced for AGI above these amounts.
// The exemption phases down to $0 at very high income levels.
// Source: PolicyEngine (cites MD Code Tax-General 10-211(c)(2))
export const MD_EXEMPTION_PHASEOUT_START: Record<string, number> = {
  single: 100000,
  married_joint: 150000,
  married_separate: 100000,
  head_of_household: 150000,
};

// ─── MD County Piggyback Tax Rates (2025) ────────────────────────
// 24 counties + Baltimore City — each sets its own rate.
// The county tax is computed on MD taxable income (same base as state).

export const MD_COUNTY_RATES: Record<string, number> = {
  ALLEGANY:        0.0305,
  ANNE_ARUNDEL:    0.0281,
  BALTIMORE_COUNTY: 0.0320,
  BALTIMORE_CITY:  0.0320,
  CALVERT:         0.0300,
  CAROLINE:        0.0320,
  CARROLL:         0.0305,
  CECIL:           0.0300,
  CHARLES:         0.0303,
  DORCHESTER:      0.0320,
  FREDERICK:       0.0300,
  GARRETT:         0.0265,
  HARFORD:         0.0306,
  HOWARD:          0.0320,
  KENT:            0.0285,
  MONTGOMERY:      0.0320,
  PRINCE_GEORGES:  0.0320,
  QUEEN_ANNES:     0.0320,
  ST_MARYS:        0.0317,
  SOMERSET:        0.0315,
  TALBOT:          0.0240,
  WASHINGTON:      0.0320,
  WICOMICO:        0.0320,
  WORCESTER:       0.0225,
};

// Default county rate if no county is selected (state-wide average)
export const MD_DEFAULT_COUNTY_RATE = 0.0307;

// ─── MD EITC (2025) ─────────────────────────────────────────────
// Maryland EITC has two components:
//   - Refundable: 45% of federal EITC
//   - Nonrefundable: 100% of federal EITC
// For simplicity, we model the refundable portion (45%) which is
// the more impactful component for most eligible filers.
export const MD_EITC_REFUNDABLE_RATE = 0.45;
