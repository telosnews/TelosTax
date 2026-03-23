/**
 * Ohio State Tax Constants — Tax Year 2025
 *
 * Sources:
 *   - Ohio Rev. Code §5747.02 — Ohio income tax rates
 *   - Ohio Rev. Code §5747.025 — Personal exemption and phase-out
 *   - Ohio IT 1040 Instructions — Ohio Individual Income Tax Return
 *   - Ohio Department of Taxation — Tax Rate Schedule
 *
 * Key Ohio characteristics:
 *   - No standard deduction
 *   - AGI-phased personal exemption ($2,400 at AGI ≤ $40K, phases to $0 above $80K)
 *   - Social Security fully exempt
 *   - 3 effective brackets (0%, 2.75%, 3.5%)
 */

import { StateTaxBracket } from '../../types/index.js';

// ─── OH Income Tax Brackets (2025) ──────────────────────────────
// Ohio uses the same brackets for all filing statuses.
// Bracket 1: 0% on first $26,050 (effectively a zero bracket)
// Bracket 2: 2.75% from $26,050 to $100,000
// Bracket 3: 3.50% above $100,000

const OH_BRACKET_SCHEDULE: StateTaxBracket[] = [
  { min: 0,       max: 26050,    rate: 0.0 },
  { min: 26050,   max: 100000,   rate: 0.0275 },
  { min: 100000,  max: Infinity,  rate: 0.035 },
];

export const OH_BRACKETS: Record<string, StateTaxBracket[]> = {
  single:            OH_BRACKET_SCHEDULE,
  married_joint:     OH_BRACKET_SCHEDULE,
  married_separate:  OH_BRACKET_SCHEDULE,
  head_of_household: OH_BRACKET_SCHEDULE,
};

// ─── OH Personal Exemption (2025) ───────────────────────────────
// Ohio provides a personal exemption that phases out based on Ohio AGI.
// Full exemption: $2,400 per exemption at AGI ≤ $40,000
// Phases down linearly to $0 at AGI > $80,000

export const OH_PERSONAL_EXEMPTION_AMOUNT = 2400;

/** AGI at or below this threshold: full exemption */
export const OH_EXEMPTION_PHASEOUT_START = 40000;

/** AGI above this threshold: exemption is $0 */
export const OH_EXEMPTION_PHASEOUT_END = 80000;

// ─── OH Social Security Exemption ───────────────────────────────
// Ohio fully exempts Social Security benefits from state taxation.
// (Ohio Rev. Code §5747.01(A) — Social Security not included in Ohio AGI)
