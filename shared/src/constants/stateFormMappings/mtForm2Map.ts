/**
 * MT Form 2 Montana Individual Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the 2025 MT Form 2 fillable PDF.
 *
 * MT uses progressive tax with 2 brackets (4.7% / 5.9%).
 * Starting point: federal taxable income. No standard deduction or
 * personal/dependent exemptions at state level (zeroed out in config).
 *
 * PDF field names are human-readable (e.g., "Primary Taxpayer's First Name",
 * "Page 1 Line 1"). Page 2 lines handle payments/refund.
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const MT_FORM2_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  // Taxpayer name
  {
    pdfFieldName: "Primary Taxpayer's First Name",
    sourcePath: 'firstName',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: "Primary Taxpayer's Middle Initial",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: "Primary Taxpayer's Last Name",
    sourcePath: 'lastName',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: "Primary Taxpayer's SSN",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Spouse
  {
    pdfFieldName: "Spouse's First Name",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  {
    pdfFieldName: "Spouse's Middle Initial",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseMiddleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: "Spouse's Last Name",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: "Spouse's SSN",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // Address
  {
    pdfFieldName: 'Mailing Address',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  {
    pdfFieldName: 'City',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressCity || '').toUpperCase(),
  },
  {
    pdfFieldName: 'State',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressState || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Zip+4 Code',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.addressZip || '',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 1 — INCOME & TAX (Lines 1–26)
  // ═══════════════════════════════════════════════════════════════

  // Line 1: Federal Adjusted Gross Income
  {
    pdfFieldName: 'Page 1 Line 1',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 2: Additions (Schedule I, Part I)
  {
    pdfFieldName: 'Page 1 Line 2',
    sourcePath: 'stateAdditions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 3: Total (Line 1 + Line 2)
  {
    pdfFieldName: 'Page 1 Line 3',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const total = sr.federalAGI + sr.stateAdditions;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 4: Subtractions (Schedule I, Part II)
  {
    pdfFieldName: 'Page 1 Line 4',
    sourcePath: 'stateSubtractions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 5: Montana Adjusted Gross Income
  {
    pdfFieldName: 'Page 1 Line 5',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 6: Itemized or Standard Deduction
  {
    pdfFieldName: 'Page 1 Line 6',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 7: Montana Taxable Income
  {
    pdfFieldName: 'Page 1 Line 7',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 8: Tax from brackets
  {
    pdfFieldName: 'Page 1 Line 8',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 9: Family Income Tax Credit (not modeled separately)
  {
    pdfFieldName: 'Page 1 Line 9',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 10: Tax after family credit
  {
    pdfFieldName: 'Page 1 Line 10',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Lines 11a-11e: Non-refundable credits (sub-items)
  // Line 11: Total Non-refundable Credits
  {
    pdfFieldName: 'Page 1 Line 11',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateCredits > 0 ? Math.round(sr.stateCredits).toString() : '';
    },
  },

  // Line 12: Tax after non-refundable credits
  {
    pdfFieldName: 'Page 1 Line 12',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 13: Use Tax (not modeled)
  {
    pdfFieldName: 'Page 1 Line 13',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 14: Total Tax
  {
    pdfFieldName: 'Page 1 Line 14',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 15: Earned Income Credit (MT EITC)
  {
    pdfFieldName: 'Page 1 Line 15',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const eitc = sr.additionalLines?.stateEITC || 0;
      return eitc > 0 ? Math.round(eitc).toString() : '';
    },
  },

  // Line 16: Montana Tax Withheld
  {
    pdfFieldName: 'Page 1 Line 16',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 17: Estimated Payments
  {
    pdfFieldName: 'Page 1 Line 17',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 22: Total Payments and Credits
  {
    pdfFieldName: 'Page 1 Line 22',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const total = sr.stateWithholding + sr.stateEstimatedPayments;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 23: Overpayment
  {
    pdfFieldName: 'Page 1 Line 23',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 24: Tax Due
  {
    pdfFieldName: 'Page 1 Line 24',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 2 — REFUND / AMOUNT OWED
  // ═══════════════════════════════════════════════════════════════

  // Page 2 Line 1: Overpayment (from Page 1 Line 23)
  {
    pdfFieldName: 'Page 2 Line 1',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Page 2 Line 10: Refund
  {
    pdfFieldName: 'Page 2 Line 10',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Page 2 Line 11: Tax Due (from Page 1 Line 24)
  {
    pdfFieldName: 'Page 2 Line 11',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Page 2 Line 13: Total Amount Due
  {
    pdfFieldName: 'Page 2 Line 13',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const MT_FORM2_TEMPLATE: StateFormTemplate = {
  formId: 'mt-form2',
  stateCode: 'MT',
  displayName: 'Form 2 Montana Individual Income Tax Return',
  pdfFileName: 'mt-form2.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'MT',
  fields: MT_FORM2_FIELDS,
};
