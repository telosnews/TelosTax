/**
 * MD-502 Maryland Resident Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 MD Form 502 fillable PDF.
 *
 * MD-502 AcroForm fields use descriptive names (e.g., "Enter your first name").
 */
import type { TaxReturn, CalculationResult, StateCalculationResult } from '../../types/index.js';
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const MD_502_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  // SSN
  {
    pdfFieldName: 'Enter social security number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },
  // Your first name
  {
    pdfFieldName: 'Enter your first name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  // Your middle initial
  {
    pdfFieldName: 'Enter your middle initial',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  // Your last name
  {
    pdfFieldName: 'Enter your last name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  // Spouse first name
  {
    pdfFieldName: "Enter Spouse's First Name",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  // Spouse middle initial
  {
    pdfFieldName: "Enter Spouse's middle initial",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseMiddleInitial || '').toUpperCase(),
  },
  // Spouse last name
  {
    pdfFieldName: "Enter Spouse's last name",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || '').toUpperCase(),
  },
  // Spouse SSN
  {
    pdfFieldName: "Enter spouse's social security number",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },
  // Address Line 1
  {
    pdfFieldName: 'Enter Current Mailing Address Line 1 (Street No. and Street Name or PO Box)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  // City
  {
    pdfFieldName: 'Enter city or town',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressCity || '').toUpperCase(),
  },
  // State
  {
    pdfFieldName: 'Enter state',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressState || '').toUpperCase(),
  },

  // ═══════════════════════════════════════════════════════════════
  // INCOME
  // ═══════════════════════════════════════════════════════════════

  // Line 1: Federal AGI
  {
    pdfFieldName: 'Enter 1',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 1a: Wages (W-2 income)
  {
    pdfFieldName: 'Enter 1a',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.w2Income || []).reduce((sum, w) => sum + (w.wages || 0), 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 2: MD AGI (after additions/subtractions)
  {
    pdfFieldName: 'Enter 2',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 3: Deduction method — standard deduction
  {
    pdfFieldName: 'Enter 3',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 4: MD taxable income (Net income)
  {
    pdfFieldName: 'Enter 4',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // EXEMPTIONS (Section A/B/C/D)
  // ═══════════════════════════════════════════════════════════════

  // Section A exemptions dollar amount
  {
    pdfFieldName: 'Enter A $',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const exemptions = sr.stateExemptions || 0;
      return exemptions > 0 ? Math.round(exemptions).toString() : '';
    },
  },

  // Total exemptions (Section D)
  {
    pdfFieldName: 'D. Enter Dollar Amount Total Exemptions (Add A, B and C.) ',
    sourcePath: 'stateExemptions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // TAX COMPUTATION
  // ═══════════════════════════════════════════════════════════════

  // Line 5: MD state income tax
  {
    pdfFieldName: 'Enter 5',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 6: MD EITC
  {
    pdfFieldName: 'Enter 6',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const mdEITC = sr.additionalLines?.mdEITC || 0;
      return mdEITC > 0 ? Math.round(mdEITC).toString() : '';
    },
  },

  // Line 7: Tax after credits
  {
    pdfFieldName: 'Enter 7',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Local tax rate
  {
    pdfFieldName: 'Enter local tax rate',
    sourcePath: '',
    source: 'stateResult',
    format: 'string',
    transform: (_tr, _calc, sr) => {
      const rate = sr.additionalLines?.countyRate || 0;
      return rate > 0 ? (rate * 100).toFixed(4) : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS & BALANCE
  // ═══════════════════════════════════════════════════════════════

  // Line 8: MD tax withheld
  {
    pdfFieldName: 'Enter 8',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 9: Estimated tax payments
  {
    pdfFieldName: 'Enter 9',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 11: Total payments
  {
    pdfFieldName: 'Enter 11',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const total = sr.stateWithholding + sr.stateEstimatedPayments;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 12: Tax (total state + local)
  {
    pdfFieldName: 'Enter 12',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 13: Balance due (if tax > payments)
  {
    pdfFieldName: 'Enter 13',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 14: Overpayment
  {
    pdfFieldName: 'Enter 14',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 15: Refund
  {
    pdfFieldName: 'Enter 15',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const MD_502_TEMPLATE: StateFormTemplate = {
  formId: 'md-502',
  stateCode: 'MD',
  displayName: 'Form 502 Maryland Resident Income Tax Return',
  pdfFileName: 'md-502.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'MD',
  fields: MD_502_FIELDS,
};
