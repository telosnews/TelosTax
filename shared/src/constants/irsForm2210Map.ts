/**
 * IRS Form 2210 (2025) -- AcroForm Field Mapping
 *
 * Underpayment of Estimated Tax by Individuals, Estates, and Trusts
 * PDF: client/public/irs-forms/f2210.pdf (Form 2210, 2025)
 * Attachment Sequence No. 06
 * Total fields: ~30 (text: ~24, checkbox: ~6)
 *
 * Field prefix: topmostSubform[0].Page1[0] / topmostSubform[0].Page2[0]
 *
 * Layout:
 *   Page 1:
 *     f1_1 = Name(s) shown on return
 *     f1_2 = Your SSN
 *
 *     Part I -- Required Annual Payment (Lines 1-9):
 *       f1_3 = Line 1: Required annual payment (current year tax)
 *       f1_4 = Line 2: Multiply line 1 by 90% (0.90)
 *       f1_5 = Line 3: Withholding taxes
 *       f1_6 = Line 4: Subtract line 3 from line 1 (if < $1,000, no penalty)
 *       f1_7 = Line 5: Other payments (estimated tax payments made)
 *       f1_8 = Line 6: Add lines 3 and 5
 *       f1_9 = Line 7: Required annual payment (lesser of line 2 or prior year's tax)
 *       f1_10 = Line 8: If line 6 >= line 7, stop; you don't owe penalty
 *       f1_11 = Line 9: Underpayment (line 7 - line 6)
 *       (Line 10+ moved to Page 2 in 2025; penalty total → f2_37)
 *
 *     Checkboxes:
 *       c1_1 = Box A: Waiver request
 *       c1_2 = Box B: Exception (annualized income installment method)
 *       c1_3 = Box C: Exception (prior year tax)
 *       c1_4 = Box D: Exception (withholding)
 *       c1_5 = Box E: Exception
 *       c1_6 = Box F: Exception
 *
 *   Page 2:
 *     Part II -- Regular Method (Lines 11-18, quarterly columns):
 *       Quarterly detail not tracked individually in engine --
 *       left blank for manual entry.
 *
 * Engine result: calc.estimatedTaxPenalty (EstimatedTaxPenaltyResult)
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult } from '../types/index.js';
import { FilingStatus } from '../types/index.js';

const P1 = 'topmostSubform[0].Page1[0]';
const P2 = 'topmostSubform[0].Page2[0]';

/** Format a dollar amount -- blank for zero or NaN */
function fmtDollar(n: number | undefined | null): string | undefined {
  if (n === undefined || n === null || n === 0 || isNaN(n)) return undefined;
  return Math.round(n).toString();
}

export const FORM_2210_FIELDS: IRSFieldMapping[] = [
  // ======================================================================
  // Header
  // ======================================================================

  // Name(s) shown on return
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
  // SSN
  {
    pdfFieldName: `${P1}.f1_2[0]`,
    formLabel: 'Your social security number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
  },

  // ======================================================================
  // Part I -- Required Annual Payment (Lines 1-9)
  // ======================================================================

  // Line 1: Required annual payment (current year's tax liability)
  {
    pdfFieldName: `${P1}.f1_3[0]`,
    formLabel: 'Line 1: Required annual payment',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) =>
      fmtDollar(calc.estimatedTaxPenalty?.requiredAnnualPayment),
  },
  // Line 2: Multiply line 1 by 90% (0.90)
  {
    pdfFieldName: `${P1}.f1_4[0]`,
    formLabel: 'Line 2: 90% of required annual payment',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const rap = calc.estimatedTaxPenalty?.requiredAnnualPayment;
      if (!rap) return undefined;
      return fmtDollar(Math.round(rap * 0.9));
    },
  },
  // Line 3: Withholding taxes
  {
    pdfFieldName: `${P1}.f1_5[0]`,
    formLabel: 'Line 3: Withholding taxes',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.form1040.totalWithholding),
  },
  // Line 4: Subtract line 3 from line 1 (if result < $1,000, no penalty)
  {
    pdfFieldName: `${P1}.f1_6[0]`,
    formLabel: 'Line 4: Tax after withholding',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const rap = calc.estimatedTaxPenalty?.requiredAnnualPayment ?? 0;
      const withholding = calc.form1040.totalWithholding ?? 0;
      const diff = Math.max(0, rap - withholding);
      return fmtDollar(diff);
    },
  },
  // Line 5: Other payments (estimated tax payments made)
  {
    pdfFieldName: `${P1}.f1_7[0]`,
    formLabel: 'Line 5: Estimated tax payments and other amounts paid',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.form1040.estimatedPayments),
  },
  // Line 6: Add lines 3 and 5 (total withholding + estimated payments)
  {
    pdfFieldName: `${P1}.f1_8[0]`,
    formLabel: 'Line 6: Total payments made',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) =>
      fmtDollar(calc.estimatedTaxPenalty?.totalPaymentsMade),
  },
  // Line 7: Required annual payment (lesser of 90% current or 100%/110% prior year)
  // The engine computes this as the requiredAnnualPayment which already applies safe harbor
  {
    pdfFieldName: `${P1}.f1_9[0]`,
    formLabel: 'Line 7: Required annual payment',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) =>
      fmtDollar(calc.estimatedTaxPenalty?.requiredAnnualPayment),
  },
  // Line 8: If line 6 >= line 7, no penalty; otherwise penalty applies
  // Show the shortfall or blank if no shortfall
  {
    pdfFieldName: `${P1}.f1_10[0]`,
    formLabel: 'Line 8: Shortfall amount',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const payments = calc.estimatedTaxPenalty?.totalPaymentsMade ?? 0;
      const required = calc.estimatedTaxPenalty?.requiredAnnualPayment ?? 0;
      if (payments >= required) return undefined; // No penalty
      return fmtDollar(required - payments);
    },
  },
  // Line 9: Underpayment amount
  {
    pdfFieldName: `${P1}.f1_11[0]`,
    formLabel: 'Line 9: Underpayment amount',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) =>
      fmtDollar(calc.estimatedTaxPenalty?.underpaymentAmount),
  },
  // Line 10: Penalty (regular method)
  {
    pdfFieldName: `${P2}.f2_37[0]`,
    formLabel: 'Line 18: Penalty',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) =>
      fmtDollar(calc.estimatedTaxPenalty?.penalty),
  },

  // ======================================================================
  // Checkboxes A-F (waiver/exception boxes)
  // ======================================================================

  // Box A: Waiver request -- not auto-checked
  {
    pdfFieldName: `${P1}.c1_1[0]`,
    formLabel: 'Box A: Waiver request',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: () => false,
  },
  // Box B: Annualized income installment method
  {
    pdfFieldName: `${P1}.c1_2[0]`,
    formLabel: 'Box B: Annualized income installment method',
    sourcePath: '',
    source: 'calculationResult',
    format: 'checkbox',
    transform: (_tr, calc) =>
      calc.estimatedTaxPenalty?.usedAnnualizedMethod === true,
  },
  // Box C: Exception -- not auto-checked
  {
    pdfFieldName: `${P1}.c1_3[0]`,
    formLabel: 'Box C: Prior year tax exception',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: () => false,
  },
  // Box D: Exception -- not auto-checked
  {
    pdfFieldName: `${P1}.c1_4[0]`,
    formLabel: 'Box D: Withholding exception',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: () => false,
  },
  // Box E: Exception -- not auto-checked
  {
    pdfFieldName: `${P1}.c1_5[0]`,
    formLabel: 'Box E: Exception',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: () => false,
  },
  // Box F: Exception -- not auto-checked
  {
    pdfFieldName: `${P1}.c1_6[0]`,
    formLabel: 'Box F: Exception',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: () => false,
  },

  // ======================================================================
  // Page 2 -- Part II: Regular Method (quarterly columns)
  // Lines 11-18 with columns (a) through (d) for each quarter.
  // The engine does not track individual quarterly payment dates/amounts
  // in sufficient detail to populate these cells. Left empty for
  // manual completion by the taxpayer.
  // ======================================================================
];

export const FORM_2210_TEMPLATE: IRSFormTemplate = {
  formId: 'f2210',
  displayName: 'Form 2210',
  attachmentSequence: 6,
  pdfFileName: 'f2210.pdf',
  condition: (_tr, calc) => (calc.estimatedTaxPenalty?.penalty ?? 0) > 0,
  fields: FORM_2210_FIELDS,
};
