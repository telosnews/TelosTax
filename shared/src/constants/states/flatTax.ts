/**
 * Flat-Tax State Constants — Tax Year 2025
 *
 * These states levy a single (flat) rate on taxable income, with varying
 * deduction and exemption rules.
 *
 * Sources:
 *   - PA: 72 P.S. §7302 — 3.07% flat rate
 *   - IL: 35 ILCS 5/201(b)(5.3) — 4.95% flat rate
 *   - MA: M.G.L. c.62 §4 — 5.0% Part A / 8.5% ST cap gains / 5% LT cap gains
 *   - NC: N.C.G.S. §105-153.7 — 4.25% flat rate (reduced from 4.5% for TY2025)
 *   - MI: MCL §206.51 — 4.25% flat rate
 *   - IN: IC §6-3-2-1 — 3.0% flat rate (reduced from 3.05% for TY2025)
 *   - CO: C.R.S. §39-22-104 — 4.4% flat rate (starts from federal taxable income)
 *   - KY: KRS §141.020 — 4.0% flat rate
 *   - UT: U.C.A. §59-10-104 — 4.5% flat rate with taxpayer credit (reduced from 4.65% for TY2025)
 *   - GA: O.C.G.A. §48-7-20 — 5.19% flat rate (HB 111, retroactive for TY2025)
 *   - AZ: A.R.S. §43-1011 — 2.5% flat rate (Prop 208/211 consolidated)
 *   - LA: La. R.S. 47:32 — 3.0% flat rate (Act 11 reform, TY2025)
 *   - IA: Iowa Code §422.5 — 3.8% flat rate (TY2025)
 */

// ─── Per-State Flat Tax Configuration ───────────────────────────

export interface FlatTaxStateConfig {
  stateCode: string;
  rate: number;
  /** Standard deduction by filing status key, or a single value for all. */
  standardDeduction: Record<string, number>;
  /** Personal exemption per person (taxpayer + spouse). 0 if not applicable. */
  personalExemption: number;
  /** Additional dependent exemption per dependent. 0 if not applicable. */
  dependentExemption: number;
  /** If true, start from federal taxable income instead of federal AGI. */
  usesFederalTaxableIncome?: boolean;
  /** If true, skip Social Security subtraction (state taxes SS or uses different base). */
  skipSocialSecuritySubtraction?: boolean;
  /** UT-specific: taxpayer credit rate applied to (federal std deduction + personal exemptions). */
  taxpayerCreditRate?: number;
  /** MA-specific: short-term capital gains rate (8.5% effective TY2023). */
  shortTermCapitalGainsRate?: number;
  /** MA-specific: long-term capital gains rate (5%). */
  longTermCapitalGainsRate?: number;
  /** MA-specific: long-term collectibles capital gains rate (12%). */
  collectiblesCapitalGainsRate?: number;
  /** MA-specific: 4% surtax on income over threshold (Question 1, M.G.L. c.62 §4(d)). */
  surtax?: { threshold: number; rate: number };
  /** AZ-specific: aged exemption (deduction for filers 65+). */
  agedExemption?: number;
  /** AZ-specific: dependent credit per child (nonrefundable). */
  dependentCredit?: { under17: number; age17plus: number };
  /** AZ-specific: AGI phaseout start for dependent credit. */
  dependentCreditPhaseout?: { single: number; married_joint: number };
  /** Notes for special handling or UI display. */
  notes?: string;
}

// ─── Flat Tax Constants ─────────────────────────────────────────

export const FLAT_TAX_CONSTANTS: Record<string, FlatTaxStateConfig> = {
  // ── Pennsylvania ──────────────────────────────────────────────
  // PA uses a unique system: flat 3.07% on most income types with very few
  // deductions. No standard deduction, no personal exemption.
  PA: {
    stateCode: 'PA',
    rate: 0.0307,
    standardDeduction: {
      single: 0,
      married_joint: 0,
      married_separate: 0,
      head_of_household: 0,
    },
    personalExemption: 0,
    dependentExemption: 0,
    skipSocialSecuritySubtraction: false,
    notes: 'PA taxes most income types at a flat 3.07% with virtually no deductions.',
  },

  // ── Illinois ──────────────────────────────────────────────────
  // Personal exemption of $2,850 per person (taxpayer + spouse + dependents).
  IL: {
    stateCode: 'IL',
    rate: 0.0495,
    standardDeduction: {
      single: 0,
      married_joint: 0,
      married_separate: 0,
      head_of_household: 0,
    },
    personalExemption: 2850,
    dependentExemption: 2850,
    notes: 'IL uses a per-person exemption of $2,850 for taxpayer, spouse, and each dependent.',
  },

  // ── Massachusetts ─────────────────────────────────────────────
  // Part A income (wages, interest, dividends) taxed at 5.0%.
  // Short-term capital gains at 8.5% (reduced from 12% effective TY2023), long-term at 5%.
  // Personal exemption: $4,400 (single), $8,800 (MFJ).
  MA: {
    stateCode: 'MA',
    rate: 0.05,
    standardDeduction: {
      single: 0,
      married_joint: 0,
      married_separate: 0,
      head_of_household: 0,
    },
    personalExemption: 4400,
    dependentExemption: 1000,
    shortTermCapitalGainsRate: 0.085,
    longTermCapitalGainsRate: 0.05,
    collectiblesCapitalGainsRate: 0.12,
    surtax: { threshold: 1083150, rate: 0.04 }, // Question 1: 4% on income over $1,083,150 (M.G.L. c.62 §4(d))
    notes: 'MA Part A (5%), ST cap gains (8.5%), LT cap gains (5%), LT collectibles (12%). 4% surtax on income > $1,083,150.',
  },

  // ── North Carolina ────────────────────────────────────────────
  // Standard deduction varies by filing status. No personal exemption.
  NC: {
    stateCode: 'NC',
    rate: 0.0425,
    standardDeduction: {
      single: 12750,
      married_joint: 25500,
      married_separate: 12750,
      head_of_household: 19125,
    },
    personalExemption: 0,
    dependentExemption: 0,
    notes: 'NC standard deduction varies by filing status. No personal/dependent exemptions.',
  },

  // ── Michigan ──────────────────────────────────────────────────
  // Personal exemption of $5,800 per person (taxpayer + spouse + dependents).
  MI: {
    stateCode: 'MI',
    rate: 0.0425,
    standardDeduction: {
      single: 0,
      married_joint: 0,
      married_separate: 0,
      head_of_household: 0,
    },
    personalExemption: 5800,
    dependentExemption: 5800,
    notes: 'MI uses a per-person exemption of $5,800 for taxpayer, spouse, and each dependent.',
  },

  // ── Indiana ───────────────────────────────────────────────────
  // Personal exemption $1,000 per person + $1,500 per dependent.
  IN: {
    stateCode: 'IN',
    rate: 0.03,
    standardDeduction: {
      single: 0,
      married_joint: 0,
      married_separate: 0,
      head_of_household: 0,
    },
    personalExemption: 1000,
    dependentExemption: 1500,
    notes: 'IN personal exemption $1,000 per person (taxpayer + spouse), plus $1,500 per dependent.',
  },

  // ── Colorado ──────────────────────────────────────────────────
  // Starts from federal taxable income — very simple. No additional deductions.
  CO: {
    stateCode: 'CO',
    rate: 0.044,
    standardDeduction: {
      single: 0,
      married_joint: 0,
      married_separate: 0,
      head_of_household: 0,
    },
    personalExemption: 0,
    dependentExemption: 0,
    usesFederalTaxableIncome: true,
    notes: 'CO starts from federal taxable income. No additional state deductions or exemptions.',
  },

  // ── Kentucky ──────────────────────────────────────────────────
  // Standard deduction of $3,270 (same for all filing statuses).
  KY: {
    stateCode: 'KY',
    rate: 0.04,
    standardDeduction: {
      single: 3270,
      married_joint: 3270,
      married_separate: 3270,
      head_of_household: 3270,
    },
    personalExemption: 0,
    dependentExemption: 0,
    notes: 'KY standard deduction is $3,270 regardless of filing status.',
  },

  // ── Utah ──────────────────────────────────────────────────────
  // Flat 4.65% on all income, but offers a taxpayer credit equal to 6% of
  // (federal standard deduction + personal exemptions), effectively lowering
  // the rate for lower/middle-income filers.
  UT: {
    stateCode: 'UT',
    rate: 0.045,
    standardDeduction: {
      single: 0,
      married_joint: 0,
      married_separate: 0,
      head_of_household: 0,
    },
    personalExemption: 0,
    dependentExemption: 0,
    taxpayerCreditRate: 0.06,
    notes: 'UT taxpayer credit = 6% of (federal standard deduction + federal personal exemptions). This credit phases out at higher incomes.',
  },

  // ── Georgia ──────────────────────────────────────────────────────
  // HB 111 retroactive flat rate for TY2025. Standard deduction varies
  // by filing status. Personal exemption repealed; $4,000/dependent.
  GA: {
    stateCode: 'GA',
    rate: 0.0519,
    standardDeduction: {
      single: 12000,
      married_joint: 24000,
      married_separate: 12000,
      head_of_household: 12000,
    },
    personalExemption: 0,
    dependentExemption: 4000,
    notes: 'GA HB 111 (2025): retroactive flat 5.19% rate. Personal exemption repealed. $4,000 per dependent.',
  },

  // ── Arizona ──────────────────────────────────────────────────────
  // Flat 2.5% rate. Conforms to federal standard deduction.
  // $2,100 personal exemption, $100 dependent exemption.
  AZ: {
    stateCode: 'AZ',
    rate: 0.025,
    standardDeduction: {
      single: 15750,
      married_joint: 31500,
      married_separate: 15750,
      head_of_household: 23625,
    },
    personalExemption: 0,
    dependentExemption: 0,
    agedExemption: 2100,  // $2,100 for filers 65+ only (ARS §43-1023)
    dependentCredit: { under17: 100, age17plus: 25 },  // Nonrefundable (ARS §43-1073.01)
    dependentCreditPhaseout: { single: 200000, married_joint: 400000 },  // AGI phaseout start
    notes: 'AZ flat 2.5% rate. Federal standard deduction conformity. Aged exemption ($2,100 for 65+). Dependent credit ($100 under-17 / $25 17+) with AGI phaseout.',
  },

  // ── Louisiana ────────────────────────────────────────────────────
  // Act 11 (2025) — new flat 3.0% rate replacing graduated brackets.
  // New standard deduction structure, no personal/dependent exemptions.
  LA: {
    stateCode: 'LA',
    rate: 0.03,
    standardDeduction: {
      single: 12500,
      married_joint: 25000,
      married_separate: 12500,
      head_of_household: 25000,
    },
    personalExemption: 0,
    dependentExemption: 0,
    notes: 'LA Act 11 (2025): flat 3.0% replaces prior 1.85-4.25% graduated brackets. New standard deduction. Exemptions repealed.',
  },

  // ── Iowa ─────────────────────────────────────────────────────────
  // Flat 3.8% rate for TY2025 (phasing down from prior graduated rates).
  // Small standard deductions. $40 personal exemption credit.
  IA: {
    stateCode: 'IA',
    rate: 0.038,
    standardDeduction: {
      single: 15750,
      married_joint: 31500,
      married_separate: 15750,
      head_of_household: 23625,
    },
    personalExemption: 40,
    dependentExemption: 40,
    notes: 'IA flat 3.8% for TY2025. Federal standard deduction conformity since 2023. $40 per exemption.',
  },
};

// ─── Massachusetts Filing-Status-Specific Exemptions ────────────
// MA personal exemption varies by filing status (not a flat per-person amount).
export const MA_PERSONAL_EXEMPTION: Record<string, number> = {
  single: 4400,
  married_joint: 8800,
  married_separate: 4400,
  head_of_household: 6800,  // HoH gets higher exemption per MA Form 1 instructions
};
