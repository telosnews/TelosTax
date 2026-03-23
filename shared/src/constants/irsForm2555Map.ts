/**
 * IRS Form 2555 (2025) -- AcroForm Field Mapping
 *
 * Foreign Earned Income
 * PDF: client/public/irs-forms/f2555.pdf (Form 2555, 2025)
 * Attachment Sequence No. 34
 *
 * Field prefixes:
 *   Page 1: topmostSubform[0].Page1[0]  -- f1_1 through f1_21 (personal info, Parts I-III)
 *   Page 2: topmostSubform[0].Page2[0]  -- f2_1 through f2_33 (Parts IV-VI: foreign presence, housing)
 *   Page 3: topmostSubform[0].Page3[0]  -- f3_1 through f3_21 (Parts VII-IX: housing deduction, exclusion)
 *
 * Layout:
 *   Page 1:
 *     f1_1 = Name(s) shown on Form 1040
 *     f1_2 = Your social security number
 *     f1_3-f1_8 = Part I: General Information (employer name, address, etc.)
 *     f1_9-f1_15 = Part II: Qualifying Tests (tax home, bona fide residence dates)
 *     f1_16-f1_21 = Part III: Physical Presence Test (dates in/out of US)
 *
 *   Page 2:
 *     f2_1-f2_9 = Part IV: All Taxpayers (bona fide/physical presence detail)
 *     f2_10-f2_20 = Part V: Taxpayers Claiming Foreign Earned Income Credit
 *     f2_21-f2_33 = Part VI: Housing Costs (expenses, base, max, employer-provided)
 *
 *   Page 3:
 *     f3_1-f3_5 = Part VII: Housing Deduction (self-employed)
 *     f3_6-f3_14 = Part VIII: Foreign Earned Income Exclusion
 *       f3_6 = Line 45: Foreign earned income
 *       f3_7 = Line 46: Maximum exclusion ($130,000 for 2025)
 *       f3_8 = Line 47: Days qualifying / 365 prorated exclusion
 *       f3_9 = Line 48: Enter the smaller of line 45 or line 47
 *     f3_15-f3_21 = Part IX: Deductions/Exclusion Summary (flows to Schedule 1)
 *       f3_15 = Line 50: Housing deduction from Part VII
 *       f3_16 = Line 51: Housing exclusion from Part VI
 *       f3_17 = Line 52: Foreign earned income exclusion (from line 48)
 *       f3_18 = Line 53: Add lines 50, 51, and 52
 *
 * Engine data sources:
 *   tr.foreignEarnedIncome: ForeignEarnedIncomeInfo { foreignEarnedIncome, qualifyingDays?, housingExpenses? }
 *   calc.feie: { incomeExclusion: number; housingExclusion: number }
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult } from '../types/index.js';
import { FEIE } from './tax2025.js';

const P1 = 'topmostSubform[0].Page1[0]';
const P2 = 'topmostSubform[0].Page2[0]';
const P3 = 'topmostSubform[0].Page3[0]';

/** Format a dollar amount -- blank for zero or NaN */
function fmtDollar(n: number | undefined | null): string | undefined {
  if (n === undefined || n === null || n === 0 || isNaN(n)) return undefined;
  return Math.round(n).toString();
}

export const FORM_2555_FIELDS: IRSFieldMapping[] = [
  // ================================================================
  // Page 1 -- Header
  // ================================================================

  // f1_1: Name(s) shown on Form 1040
  {
    pdfFieldName: `${P1}.f1_1[0]`,
    formLabel: 'Name(s) shown on Form 1040',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => `${tr.firstName || ''} ${tr.lastName || ''}`.trim() || undefined,
  },
  // f1_2: Your social security number
  {
    pdfFieldName: `${P1}.f1_2[0]`,
    formLabel: 'Your social security number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
  },

  // ================================================================
  // Page 1 -- Part I: General Information (f1_3 through f1_8)
  // Employer name, address, employer type -- data-entry detail
  // not modeled in engine; leave unmapped
  // ================================================================

  // ================================================================
  // Page 1 -- Part II: Qualifying Tests (f1_9 through f1_15)
  // Tax home, bona fide residence dates -- data-entry detail
  // not modeled in engine; leave unmapped
  // ================================================================

  // ================================================================
  // Page 1 -- Part III: Physical Presence Test (f1_16 through f1_21)
  // Dates entering/leaving US -- data-entry detail
  // not modeled in engine; leave unmapped
  // ================================================================

  // ================================================================
  // Page 2 -- Part IV: All Taxpayers (f2_1 through f2_9)
  // Detail about bona fide/physical presence qualification
  // not modeled in engine; leave unmapped
  // ================================================================

  // ================================================================
  // Page 2 -- Part V: Taxpayers Claiming FEI Credit (f2_10 through f2_20)
  // Detail about foreign income earned, allowances, meals, etc.
  // not modeled in engine; leave unmapped
  // ================================================================

  // ================================================================
  // Page 2 -- Part VI: Housing Costs (f2_21 through f2_33)
  // ================================================================

  // f2_21: Line 32 — Qualified housing expenses
  {
    pdfFieldName: `${P2}.f2_21[0]`,
    formLabel: 'Line 32: Qualified housing expenses',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.foreignEarnedIncome?.housingExpenses),
  },
  // f2_22: Line 33 — Base housing amount ($20,280 for 2025)
  {
    pdfFieldName: `${P2}.f2_22[0]`,
    formLabel: 'Line 33: Base housing amount',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: () => fmtDollar(FEIE.HOUSING_BASE),
  },
  // f2_23: Line 34 — Subtract line 33 from line 32 (excess housing)
  {
    pdfFieldName: `${P2}.f2_23[0]`,
    formLabel: 'Line 34: Excess housing expenses',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const expenses = tr.foreignEarnedIncome?.housingExpenses ?? 0;
      const excess = Math.max(0, expenses - FEIE.HOUSING_BASE);
      return fmtDollar(excess);
    },
  },
  // f2_24: Line 35 — Housing limitation ($39,000 for 2025)
  {
    pdfFieldName: `${P2}.f2_24[0]`,
    formLabel: 'Line 35: Housing limitation',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: () => fmtDollar(FEIE.HOUSING_MAX_EXCLUSION),
  },
  // f2_25: Line 36 — Smaller of line 34 or line 35 (housing amount)
  {
    pdfFieldName: `${P2}.f2_25[0]`,
    formLabel: 'Line 36: Housing exclusion amount',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.feie?.housingExclusion),
  },

  // f2_26 through f2_33: Employer-provided / carryover detail
  // Not modeled in engine; leave unmapped

  // ================================================================
  // Page 3 -- Part VII: Housing Deduction (self-employed only)
  // f3_1 through f3_5 -- not modeled in engine; leave unmapped
  // ================================================================

  // ================================================================
  // Page 3 -- Part VIII: Foreign Earned Income Exclusion
  // ================================================================

  // f3_6: Line 45 — Foreign earned income amount
  {
    pdfFieldName: `${P3}.f3_6[0]`,
    formLabel: 'Line 45: Foreign earned income',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.foreignEarnedIncome?.foreignEarnedIncome),
  },
  // f3_7: Line 46 — Maximum foreign earned income exclusion ($130,000 for 2025)
  {
    pdfFieldName: `${P3}.f3_7[0]`,
    formLabel: 'Line 46: Maximum exclusion',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: () => fmtDollar(FEIE.EXCLUSION_AMOUNT),
  },
  // f3_8: Line 47 — Prorated exclusion (qualifying days / 365 * max exclusion)
  {
    pdfFieldName: `${P3}.f3_8[0]`,
    formLabel: 'Line 47: Prorated exclusion',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const days = tr.foreignEarnedIncome?.qualifyingDays;
      if (days === undefined || days === null) {
        // If no days specified, assume full year
        return fmtDollar(FEIE.EXCLUSION_AMOUNT);
      }
      const ratio = Math.min(days, 365) / 365;
      return fmtDollar(Math.round(FEIE.EXCLUSION_AMOUNT * ratio));
    },
  },
  // f3_9: Line 48 — FEIE exclusion: smaller of line 45 or line 47
  {
    pdfFieldName: `${P3}.f3_9[0]`,
    formLabel: 'Line 48: Foreign earned income exclusion',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.feie?.incomeExclusion),
  },

  // f3_10 through f3_14: Wage subtraction detail (lines 49a-49d)
  // Not modeled in engine; leave unmapped

  // ================================================================
  // Page 3 -- Part IX: Deductions/Exclusion Summary
  // ================================================================

  // f3_15: Line 50 — Housing deduction (from Part VII, self-employed only)
  // Not modeled in engine; leave unmapped

  // f3_16: Line 51 — Housing exclusion (from Part VI, line 36)
  {
    pdfFieldName: `${P3}.f3_16[0]`,
    formLabel: 'Line 51: Housing exclusion',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.feie?.housingExclusion),
  },
  // f3_17: Line 52 — Foreign earned income exclusion (from line 48)
  {
    pdfFieldName: `${P3}.f3_17[0]`,
    formLabel: 'Line 52: Foreign earned income exclusion',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.feie?.incomeExclusion),
  },
  // f3_18: Line 53 — Total: Add lines 50, 51, and 52
  {
    pdfFieldName: `${P3}.f3_18[0]`,
    formLabel: 'Line 53: Total exclusions and deductions',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const income = calc.feie?.incomeExclusion ?? 0;
      const housing = calc.feie?.housingExclusion ?? 0;
      // Part VII housing deduction not modeled; total = income + housing exclusions
      return fmtDollar(income + housing);
    },
  },
];

export const FORM_2555_TEMPLATE: IRSFormTemplate = {
  formId: 'f2555',
  displayName: 'Form 2555',
  attachmentSequence: 34,
  pdfFileName: 'f2555.pdf',
  condition: (_tr, calc) =>
    (calc.feie?.incomeExclusion ?? 0) > 0 ||
    (_tr.foreignEarnedIncome?.foreignEarnedIncome ?? 0) > 0,
  fields: FORM_2555_FIELDS,
};
