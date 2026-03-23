/**
 * IN IT-40 Indiana Full-Year Resident Individual Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 IT-40 fillable PDF.
 *
 * IN uses federal AGI as starting point. Flat 3.0% rate.
 * Personal exemption: $1,000/person + $1,500/dependent.
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const IN_IT40_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: 'Your First Name',
    sourcePath: 'firstName',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Your Middle Initial',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Your Last Name',
    sourcePath: 'lastName',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Your Suffix',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.suffix || '').toUpperCase(),
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
    pdfFieldName: 'Spouse Middle Initial',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseMiddleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Spouse Last Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Spouse Suffix',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSuffix || '').toUpperCase(),
  },

  // Address
  {
    pdfFieldName: 'Present Address',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Present City',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressCity || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Present State',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressState || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Present ZIP',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.addressZip || '',
  },

  // ═══════════════════════════════════════════════════════════════
  // INCOME & TAX (Lines 1−8)
  // ═══════════════════════════════════════════════════════════════

  // Line 1A: Federal Adjusted Gross Income
  {
    pdfFieldName: 'Line 1A',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 2A: Indiana Add-backs
  {
    pdfFieldName: 'Line 2A',
    sourcePath: 'stateAdditions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 3A: Total (Line 1 + Line 2)
  {
    pdfFieldName: 'Line 3A',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return Math.round(sr.federalAGI + sr.stateAdditions).toString();
    },
  },

  // Line 4A: Deductions (Schedule 2)
  {
    pdfFieldName: 'Line 4A',
    sourcePath: 'stateSubtractions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 5A: State Adjusted Gross Income
  {
    pdfFieldName: 'Line 5A',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 6: Exemptions
  {
    pdfFieldName: 'Line 6',
    sourcePath: 'stateExemptions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 7: Taxable Income (Line 5 − Line 6)
  {
    pdfFieldName: 'Line 7',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 8: State Adjusted Gross Income Tax (3.0%)
  {
    pdfFieldName: 'Line 8',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 9: Credits
  {
    pdfFieldName: 'Line 9',
    sourcePath: 'stateCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 10: Tax after credits (state tax + county tax line)
  {
    pdfFieldName: 'Line 10',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS & REFUND (Lines 12−15)
  // ═══════════════════════════════════════════════════════════════

  // Line 12: Indiana State Tax Withheld
  {
    pdfFieldName: 'Line 12',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 13: Estimated tax paid
  {
    pdfFieldName: 'Line 13',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 14: Overpayment / Refund
  {
    pdfFieldName: 'Line 14',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 15: Amount You Owe
  {
    pdfFieldName: 'Line 15',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const IN_IT40_TEMPLATE: StateFormTemplate = {
  formId: 'in-it40',
  stateCode: 'IN',
  displayName: 'IT-40 Indiana Full-Year Resident Individual Income Tax Return',
  pdfFileName: 'in-it40.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'IN',
  fields: IN_IT40_FIELDS,
};
