/**
 * NC D-400 North Carolina Individual Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the 2025 D-400 fillable PDF.
 *
 * NC uses federal AGI as starting point. Flat 4.25% rate.
 * Standard deduction varies by filing status. No personal/dependent exemptions.
 *
 * Real PDF field names use the `y_d400wf_` prefix (e.g., y_d400wf_fname1).
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const NC_D400_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: 'y_d400wf_fname1',
    sourcePath: 'firstName',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'y_d400wf_mi1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'y_d400wf_lname1',
    sourcePath: 'lastName',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'y_d400wf_ssn1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Spouse
  {
    pdfFieldName: 'y_d400wf_fname2',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'y_d400wf_mi2',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseMiddleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'y_d400wf_lname2',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'y_d400wf_ssn2',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // Address
  {
    pdfFieldName: 'y_d400wf_add',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  {
    pdfFieldName: 'y_d400wf_city',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressCity || '').toUpperCase(),
  },
  {
    pdfFieldName: 'y_d400wf_zip',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.addressZip || '',
  },

  // Filing status checkboxes
  // fstat1 = Single, fstat2 = MFJ, fstat3 = MFS, fstat4 = HoH, fstat5 = QSS
  {
    pdfFieldName: 'y_d400wf_fstat1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 1,
  },
  {
    pdfFieldName: 'y_d400wf_fstat2',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 2,
  },
  {
    pdfFieldName: 'y_d400wf_fstat3',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 3,
  },
  {
    pdfFieldName: 'y_d400wf_fstat4',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 4,
  },
  {
    pdfFieldName: 'y_d400wf_fstat5',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 5,
  },

  // Standard deduction checkbox
  {
    pdfFieldName: 'y_d400wf_ncstandarddeduction',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.deductionMethod !== 'itemized',
  },
  // Itemized deduction checkbox
  {
    pdfFieldName: 'y_d400wf_ncitemizeddeduction',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.deductionMethod === 'itemized',
  },

  // Page 2 spouse last name header
  {
    pdfFieldName: 'y_d400wf_lname2_PG2',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || tr.lastName || '').toUpperCase(),
  },

  // ═══════════════════════════════════════════════════════════════
  // INCOME & TAX (Lines 6-15)
  // ═══════════════════════════════════════════════════════════════

  // Line 6: Federal AGI
  {
    pdfFieldName: 'y_d400wf_li6_good',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 7: Additions to Federal AGI
  {
    pdfFieldName: 'y_d400wf_li7_good',
    sourcePath: 'stateAdditions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 8: Add Lines 6 and 7
  {
    pdfFieldName: 'y_d400wf_li8_good',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => Math.round(sr.federalAGI + sr.stateAdditions).toString(),
  },

  // Line 9: Deductions from Federal AGI
  {
    pdfFieldName: 'y_d400wf_li9_good',
    sourcePath: 'stateSubtractions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 10a: NC Adjusted Gross Income (if positive)
  {
    pdfFieldName: 'y_d400wf_li10a_good',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 11: NC Standard Deduction or Itemized (Page 1)
  {
    pdfFieldName: 'y_d400wf_li11_page1_good',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 12: NC Taxable Income (Page 1)
  {
    pdfFieldName: 'y_d400wf_li12_pg1_good',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 13: NC Income Tax (4.25%) (Page 1)
  {
    pdfFieldName: 'y_d400wf_li13_page1_good',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 14: Tax Credits (Page 1)
  {
    pdfFieldName: 'y_d400wf_li14_pg1_good',
    sourcePath: 'stateCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 15: NC Income Tax after credits (Page 1)
  {
    pdfFieldName: 'y_d400wf_li15_pg1_good',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 2 — PAYMENTS & REFUND (Lines 16-34)
  // ═══════════════════════════════════════════════════════════════

  // Line 16: Consumer Use Tax (not modeled)
  {
    pdfFieldName: 'y_d400wf_li16_pg2_good',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 17: Total NC Tax (Line 15 + Line 16)
  {
    pdfFieldName: 'y_d400wf_li17_pg2_good',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 18: NC Tax Withheld
  {
    pdfFieldName: 'y_d400wf_li18_pg2_good',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 19: Estimated Tax Payments
  {
    pdfFieldName: 'y_d400wf_li19_pg2_good',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 22: Total NC Tax Paid
  {
    pdfFieldName: 'y_d400wf_li22_pg2_good',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const total = sr.stateWithholding + sr.stateEstimatedPayments;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 23: Tax Due
  {
    pdfFieldName: 'y_d400wf_li23_pg2_good',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 24: Overpayment
  {
    pdfFieldName: 'y_d400wf_li24_pg2_good',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 29: Refund
  {
    pdfFieldName: 'y_d400wf_li29_pg2_good',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 32: Amount You Owe
  {
    pdfFieldName: 'y_d400wf_li32_pg2_good',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const NC_D400_TEMPLATE: StateFormTemplate = {
  formId: 'nc-d400',
  stateCode: 'NC',
  displayName: 'D-400 North Carolina Individual Income Tax Return',
  pdfFileName: 'nc-d400.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'NC',
  fields: NC_D400_FIELDS,
};
