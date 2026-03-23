/**
 * WI Form 1 Wisconsin Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 WI Form 1 fillable PDF.
 *
 * WI Form 1 AcroForm fields use short names (e.g., "fname", "lname", "7").
 */
import type { TaxReturn, CalculationResult, StateCalculationResult } from '../../types/index.js';
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const WI_FORM1_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  // Last name
  {
    pdfFieldName: 'lname',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  // First name
  {
    pdfFieldName: 'fname',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  // Middle initial
  {
    pdfFieldName: 'mi',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  // Spouse last name
  {
    pdfFieldName: 'splname',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || '').toUpperCase(),
  },
  // Spouse first name
  {
    pdfFieldName: 'sfname',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  // Spouse middle initial
  {
    pdfFieldName: 'smi',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseMiddleInitial || '').toUpperCase(),
  },
  // Address
  {
    pdfFieldName: 'address',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  // City
  {
    pdfFieldName: 'city',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressCity || '').toUpperCase(),
  },
  // State
  {
    pdfFieldName: 'state',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressState || '').toUpperCase(),
  },
  // ZIP
  {
    pdfFieldName: 'zip',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.addressZip || '',
  },

  // Page 2 header: last name
  {
    pdfFieldName: 'lnamepg2',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  // Page 2 header: first name
  {
    pdfFieldName: 'fnamepg2',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },

  // ═══════════════════════════════════════════════════════════════
  // INCOME & COMPUTATION (Page 1-2)
  // ═══════════════════════════════════════════════════════════════

  // Line 1: Wages from federal return
  {
    pdfFieldName: 'line1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.w2Income || []).reduce((sum, w) => sum + (w.wages || 0), 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 1 (field "3wages" might be W-2 state wages)
  {
    pdfFieldName: '3wages',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.w2Income || []).reduce((sum, w) => sum + (w.stateWages || w.wages || 0), 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 5: WI AGI
  {
    pdfFieldName: '5',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 7: Standard deduction
  {
    pdfFieldName: '7',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 8: WI exemptions
  {
    pdfFieldName: '8',
    sourcePath: 'stateExemptions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 9: Taxable income
  {
    pdfFieldName: '9',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 11: Tax from tax table/schedule
  {
    pdfFieldName: '11',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 14: Net tax (after credits)
  {
    pdfFieldName: '14',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS & REFUND
  // ═══════════════════════════════════════════════════════════════

  // Line 18: WI income tax withheld
  {
    pdfFieldName: '18',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 19: Estimated tax payments
  {
    pdfFieldName: '19',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 20: WI EITC
  {
    pdfFieldName: '20',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const wiEITC = sr.additionalLines?.wiEITC || 0;
      return wiEITC > 0 ? Math.round(wiEITC).toString() : '';
    },
  },

  // Line 22: Total payments and credits
  {
    pdfFieldName: '22',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const total = sr.stateWithholding + sr.stateEstimatedPayments + (sr.additionalLines?.wiEITC || 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 23: Total tax
  {
    pdfFieldName: '23',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 26: Overpayment
  {
    pdfFieldName: '26',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 27: Refund
  {
    pdfFieldName: '27',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 30: Amount owed
  {
    pdfFieldName: 'line30',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const WI_FORM1_TEMPLATE: StateFormTemplate = {
  formId: 'wi-form1',
  stateCode: 'WI',
  displayName: 'Form 1 Wisconsin Income Tax Return',
  pdfFileName: 'wi-form1.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'WI',
  fields: WI_FORM1_FIELDS,
};
