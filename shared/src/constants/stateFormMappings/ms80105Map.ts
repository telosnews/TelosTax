/**
 * MS Form 80-105 — Mississippi Resident Individual Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 Form 80-105 fillable PDF.
 *
 * MS is a progressive-tax state: 2 brackets (0% on first $10,000, 4.4% above).
 * $2,300–$4,600 standard deduction. Personal exemptions: $6,000–$12,000.
 * $1,500 dependent exemption.
 *
 * PDF: client/public/state-forms/ms-80105.pdf (159 fields)
 * Enumerated via: npx tsx scripts/enumerate-pdf-fields.ts client/public/state-forms/ms-80105.pdf
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const MS_80105_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: 'Taxpayer First Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Taxpayer Initial',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Taxpayer Last Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'SSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Spouse
  {
    pdfFieldName: 'Spouse First Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Spouse Last Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Spouse SSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // Address
  {
    pdfFieldName: 'Address',
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
    pdfFieldName: 'Zip',
    sourcePath: 'addressZip',
    source: 'taxReturn',
    format: 'string',
  },

  // Page 2 SSN
  {
    pdfFieldName: 'Page2SSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // ═══════════════════════════════════════════════════════════════
  // EXEMPTIONS
  // ═══════════════════════════════════════════════════════════════

  // Number of dependents
  {
    pdfFieldName: 'TotalDependents',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const count = (tr.dependents || []).length;
      return count > 0 ? count.toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // INCOME & TAX (Lines 10–34)
  // ═══════════════════════════════════════════════════════════════

  // Line 10: Federal AGI
  {
    pdfFieldName: 'Line10',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 17: MS Adjusted Gross Income
  {
    pdfFieldName: '17',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 21: Standard or itemized deduction
  {
    pdfFieldName: '21',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 22: Exemption (personal + dependent)
  {
    pdfFieldName: '22',
    sourcePath: 'stateExemptions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 23: Total deductions + exemptions
  {
    pdfFieldName: '23',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => Math.round(sr.stateDeduction + sr.stateExemptions).toString(),
  },

  // Line 24: Taxable income
  {
    pdfFieldName: '24',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 25: Tax (from schedule — 0% on first $10K, 4.4% above)
  {
    pdfFieldName: '25',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 28: Tax after credits
  {
    pdfFieldName: '28',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 32: Total tax
  {
    pdfFieldName: '32',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS (Lines 33–37)
  // ═══════════════════════════════════════════════════════════════

  // Line 33: MS tax withheld
  {
    pdfFieldName: '33',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 34: Estimated payments
  {
    pdfFieldName: '34',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // REFUND / AMOUNT OWED (Lines 35–37)
  // ═══════════════════════════════════════════════════════════════

  // Line 35: Overpayment / Refund
  {
    pdfFieldName: '35',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 36: Tax due
  {
    pdfFieldName: '36',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 37: Total amount owed (same as line 36 for simple returns)
  {
    pdfFieldName: '37',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const MS_80105_TEMPLATE: StateFormTemplate = {
  formId: 'ms-80105',
  stateCode: 'MS',
  displayName: 'Form 80-105 Mississippi Resident Individual Income Tax Return',
  pdfFileName: 'ms-80105.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'MS',
  fields: MS_80105_FIELDS,
};
