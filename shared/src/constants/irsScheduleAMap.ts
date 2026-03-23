/**
 * IRS Schedule A (2025) — AcroForm Field Mapping
 *
 * Itemized Deductions
 * PDF: client/public/irs-forms/f1040sa.pdf (Schedule A, 2025)
 * Attachment Sequence No. 07
 * Total fields: 33 (text: 30, checkbox: 3)
 *
 * Field prefix: form1[0].Page1[0]
 *
 * Layout:
 *   f1_1  = Name(s) shown on return
 *   f1_2  = Your SSN
 *
 *   Medical and Dental Expenses (Lines 1-4):
 *   f1_3  = Line 1: Medical and dental expenses
 *   f1_4  = Line 2: Enter amount from Form 1040, line 11 (AGI) [Line2_ReadOrder]
 *   f1_5  = Line 3: Multiply line 2 by 0.075
 *   f1_6  = Line 4: Subtract line 3 from line 1 (if line 3 > line 1, enter 0)
 *
 *   Taxes You Paid (Lines 5-7):
 *   c1_1  = Line 5a checkbox: Check if general sales tax election
 *   f1_7  = Line 5a: State and local income taxes (or general sales taxes)
 *   f1_8  = Line 5b: State and local real estate taxes
 *   f1_9  = Line 5c: State and local personal property taxes
 *   f1_10 = Line 5d: Add lines 5a through 5c
 *   f1_11 = Line 5e: Enter the smaller of line 5d or SALT cap
 *   f1_12 = Line 6: Other taxes (list type and amount)
 *   f1_13 = Line 7: Add lines 5e and 6
 *
 *   Interest You Paid (Lines 8-10):
 *   f1_14 = Line 8a: Home mortgage interest and points (Form 1098)
 *   c1_2  = Line 8a checkbox: Check if paid to someone not on 1098 [Line8_ReadOrder]
 *   f1_15 = Line 8b: Home mortgage interest not reported on Form 1098
 *   f1_16 = Line 8c: Points not reported on Form 1098 [Line8b_ReadOrder]
 *   f1_17 = Line 8d: Mortgage insurance premiums
 *   f1_18 = Line 8e: Add lines 8a through 8d
 *   f1_19 = Line 9: Investment interest (Form 4952)
 *   f1_20 = Line 10: Add lines 8e and 9
 *
 *   Gifts to Charity (Lines 11-14):
 *   f1_21 = Line 11: Gifts by cash or check
 *   f1_22 = Line 12: Other than by cash or check
 *   f1_23 = Line 13: Carryover from prior year
 *   f1_24 = Line 14: Add lines 11 through 13
 *
 *   Casualty and Theft Losses (Line 15):
 *   f1_25 = Line 15: Casualty and theft loss(es) from Form 4684
 *
 *   Other Itemized Deductions (Line 16):
 *   f1_26 = Line 16: Other (list type and amount)
 *
 *   Total Itemized Deductions (Lines 17-18):
 *   f1_27 = Line 17: Add lines 4, 7, 10, 14, 15, and 16
 *   f1_28 = Line 18: Standard deduction amount (for comparison)
 *   c1_3  = Line 18 checkbox [Line18_ReadOrder]
 *   f1_29 = (additional line, possibly total or adjustment)
 *   f1_30 = (additional line, possibly total or adjustment)
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult } from '../types/index.js';
import { FilingStatus } from '../types/index.js';

const P1 = 'form1[0].Page1[0]';

/** Format a dollar amount — blank for zero or NaN */
function fmtDollar(n: number | undefined | null): string | undefined {
  if (n === undefined || n === null || n === 0 || isNaN(n)) return undefined;
  return Math.round(n).toString();
}

export const SCHEDULE_A_FIELDS: IRSFieldMapping[] = [
  // ══════════════════════════════════════════════════════════════
  // Header
  // ══════════════════════════════════════════════════════════════

  {
    pdfFieldName: `${P1}.f1_1[0]`,
    formLabel: 'Name(s) shown on return',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.firstName, tr.lastName].filter(Boolean);
      if (tr.filingStatus === FilingStatus.MarriedFilingJointly) {
        const spouseParts = [tr.spouseFirstName, tr.spouseLastName].filter(Boolean);
        if (spouseParts.length > 0) {
          return `${parts.join(' ')} & ${spouseParts.join(' ')}`;
        }
      }
      return parts.join(' ') || undefined;
    },
  },
  {
    pdfFieldName: `${P1}.f1_2[0]`,
    formLabel: 'Your social security number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
  },

  // ══════════════════════════════════════════════════════════════
  // Medical and Dental Expenses (Lines 1-4)
  // ══════════════════════════════════════════════════════════════

  // Line 1: Medical and dental expenses
  {
    pdfFieldName: `${P1}.f1_3[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.itemizedDeductions?.medicalExpenses),
    editable: true,
    inverseTransform: (v, tr) => ({ ...(tr.itemizedDeductions || {}), medicalExpenses: Number(v) || 0 }),
    formLabel: 'Line 1: Medical and dental expenses',
  },
  // Line 2: AGI (from Form 1040, line 11)
  {
    pdfFieldName: `${P1}.Line2_ReadOrder[0].f1_4[0]`,
    formLabel: 'Line 2: Enter amount from Form 1040, line 11 (AGI)',
    sourcePath: 'form1040.agi',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },
  // Line 3: Multiply line 2 by 0.075
  {
    pdfFieldName: `${P1}.f1_5[0]`,
    formLabel: 'Line 3: Multiply line 2 by 7.5% (0.075)',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(Math.round(calc.form1040.agi * 0.075)),
  },
  // Line 4: Medical deduction (line 1 - line 3, min 0)
  {
    pdfFieldName: `${P1}.f1_6[0]`,
    formLabel: 'Line 4: Subtract line 3 from line 1 (medical deduction)',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.scheduleA?.medicalDeduction),
  },

  // ══════════════════════════════════════════════════════════════
  // Taxes You Paid (Lines 5-7)
  // ══════════════════════════════════════════════════════════════

  // Line 5a: State and local income taxes (or general sales taxes)
  {
    pdfFieldName: `${P1}.f1_7[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.itemizedDeductions?.stateLocalIncomeTax),
    editable: true,
    inverseTransform: (v, tr) => ({ ...(tr.itemizedDeductions || {}), stateLocalIncomeTax: Number(v) || 0 }),
    formLabel: 'Line 5a: State/local income taxes',
  },
  // Line 5b: State and local real estate taxes
  {
    pdfFieldName: `${P1}.f1_8[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.itemizedDeductions?.realEstateTax),
    editable: true,
    inverseTransform: (v, tr) => ({ ...(tr.itemizedDeductions || {}), realEstateTax: Number(v) || 0 }),
    formLabel: 'Line 5b: Real estate taxes',
  },
  // Line 5c: State and local personal property taxes
  {
    pdfFieldName: `${P1}.f1_9[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.itemizedDeductions?.personalPropertyTax),
    editable: true,
    inverseTransform: (v, tr) => ({ ...(tr.itemizedDeductions || {}), personalPropertyTax: Number(v) || 0 }),
    formLabel: 'Line 5c: Personal property taxes',
  },
  // Line 5d: Add lines 5a through 5c (total SALT before cap)
  {
    pdfFieldName: `${P1}.f1_10[0]`,
    formLabel: 'Line 5d: Add lines 5a through 5c',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const d = tr.itemizedDeductions;
      if (!d) return undefined;
      const total = (d.stateLocalIncomeTax || 0) + (d.realEstateTax || 0) + (d.personalPropertyTax || 0);
      return fmtDollar(total);
    },
  },
  // Line 5e: SALT deduction (after cap)
  {
    pdfFieldName: `${P1}.f1_11[0]`,
    formLabel: 'Line 5e: Enter the smaller of line 5d or $10,000',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.scheduleA?.saltDeduction),
  },
  // Line 6: Other taxes
  // (Our engine doesn't have a separate "other taxes" input — skip)

  // Line 7: Total taxes paid (= SALT deduction since we don't have other taxes)
  {
    pdfFieldName: `${P1}.f1_13[0]`,
    formLabel: 'Line 7: Add lines 5e and 6 (total taxes you paid)',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.scheduleA?.saltDeduction),
  },

  // ══════════════════════════════════════════════════════════════
  // Interest You Paid (Lines 8-10)
  // ══════════════════════════════════════════════════════════════

  // Line 8a: Home mortgage interest and points (Form 1098)
  {
    pdfFieldName: `${P1}.f1_14[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.itemizedDeductions?.mortgageInterest),
    editable: true,
    inverseTransform: (v, tr) => ({ ...(tr.itemizedDeductions || {}), mortgageInterest: Number(v) || 0 }),
    formLabel: 'Line 8a: Home mortgage interest (Form 1098)',
  },
  // Line 8d: Mortgage insurance premiums
  {
    pdfFieldName: `${P1}.f1_17[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.itemizedDeductions?.mortgageInsurancePremiums),
    editable: true,
    inverseTransform: (v, tr) => ({ ...(tr.itemizedDeductions || {}), mortgageInsurancePremiums: Number(v) || 0 }),
    formLabel: 'Line 8d: Mortgage insurance premiums',
  },
  // Line 8e: Add lines 8a through 8d
  {
    pdfFieldName: `${P1}.f1_18[0]`,
    formLabel: 'Line 8e: Add lines 8a through 8d',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const d = tr.itemizedDeductions;
      if (!d) return undefined;
      const total = (d.mortgageInterest || 0) + (d.mortgageInsurancePremiums || 0);
      return fmtDollar(total);
    },
  },
  // Line 10: Total interest deduction (from engine, after mortgage limit proration)
  {
    pdfFieldName: `${P1}.f1_20[0]`,
    formLabel: 'Line 10: Add lines 8e and 9 (total interest you paid)',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.scheduleA?.interestDeduction),
  },

  // ══════════════════════════════════════════════════════════════
  // Gifts to Charity (Lines 11-14)
  // ══════════════════════════════════════════════════════════════

  // Line 11: Gifts by cash or check
  {
    pdfFieldName: `${P1}.f1_21[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.itemizedDeductions?.charitableCash),
    editable: true,
    inverseTransform: (v, tr) => ({ ...(tr.itemizedDeductions || {}), charitableCash: Number(v) || 0 }),
    formLabel: 'Line 11: Gifts by cash or check',
  },
  // Line 12: Other than by cash or check
  {
    pdfFieldName: `${P1}.f1_22[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.itemizedDeductions?.charitableNonCash),
    editable: true,
    inverseTransform: (v, tr) => ({ ...(tr.itemizedDeductions || {}), charitableNonCash: Number(v) || 0 }),
    formLabel: 'Line 12: Other than cash or check',
  },
  // Line 14: Total charitable deduction (from engine, after AGI limits)
  {
    pdfFieldName: `${P1}.f1_24[0]`,
    formLabel: 'Line 14: Add lines 11 through 13 (total gifts to charity)',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.scheduleA?.charitableDeduction),
  },

  // ══════════════════════════════════════════════════════════════
  // Casualty and Theft Losses (Line 15)
  // ══════════════════════════════════════════════════════════════

  // Line 15: Casualty and theft loss(es)
  {
    pdfFieldName: `${P1}.f1_25[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.itemizedDeductions?.casualtyLoss),
    editable: true,
    inverseTransform: (v, tr) => ({ ...(tr.itemizedDeductions || {}), casualtyLoss: Number(v) || 0 }),
    formLabel: 'Line 15: Casualty and theft losses',
  },

  // ══════════════════════════════════════════════════════════════
  // Other Itemized Deductions (Line 16)
  // ══════════════════════════════════════════════════════════════

  // Line 16: Other itemized deductions
  {
    pdfFieldName: `${P1}.f1_26[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.itemizedDeductions?.otherDeductions),
    editable: true,
    inverseTransform: (v, tr) => ({ ...(tr.itemizedDeductions || {}), otherDeductions: Number(v) || 0 }),
    formLabel: 'Line 16: Other itemized deductions',
  },

  // ══════════════════════════════════════════════════════════════
  // Total Itemized Deductions (Line 17)
  // ══════════════════════════════════════════════════════════════

  // Line 17: Total itemized deductions
  {
    pdfFieldName: `${P1}.f1_27[0]`,
    formLabel: 'Line 17: Total itemized deductions',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.scheduleA?.totalItemized),
  },
];

export const SCHEDULE_A_TEMPLATE: IRSFormTemplate = {
  formId: 'f1040sa',
  displayName: 'Schedule A',
  attachmentSequence: 7,
  pdfFileName: 'f1040sa.pdf',
  condition: (tr, _calc) => tr.deductionMethod === 'itemized',
  fields: SCHEDULE_A_FIELDS,
};
