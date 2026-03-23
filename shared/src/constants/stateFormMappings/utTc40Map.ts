/**
 * UT TC-40 Utah Individual Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 TC-40 fillable PDF.
 *
 * UT uses federal AGI as starting point. Flat 4.5% rate.
 * Taxpayer credit = 6% of federal standard deduction (phases out at higher incomes).
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const UT_TC40_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: '40 Your first name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.firstName, tr.middleInitial].filter(Boolean);
      return parts.join(' ').toUpperCase();
    },
  },
  {
    pdfFieldName: '40 Your last name',
    sourcePath: 'lastName',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: '40 Your SSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Spouse
  {
    pdfFieldName: '40 Spouse first name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  {
    pdfFieldName: '40 Spouse last name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: '40 Spouse SSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // Address
  {
    pdfFieldName: '40 Address 1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  {
    pdfFieldName: '40 City',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressCity || '').toUpperCase(),
  },
  {
    pdfFieldName: '40 State',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressState || '').toUpperCase(),
  },
  {
    pdfFieldName: '40 Zip code',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.addressZip || '',
  },
  {
    pdfFieldName: '40 Telephone number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '',
  },

  // ═══════════════════════════════════════════════════════════════
  // INCOME & TAX (Lines 4−20)
  // ═══════════════════════════════════════════════════════════════

  // Line 4: Federal Adjusted Gross Income
  {
    pdfFieldName: '40 Line 4',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 5: State Additions
  {
    pdfFieldName: '40 Line 5',
    sourcePath: 'stateAdditions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 6: Total (AGI + additions)
  {
    pdfFieldName: '40 Line 6',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => Math.round(sr.federalAGI + sr.stateAdditions).toString(),
  },

  // Line 7: Subtractions
  {
    pdfFieldName: '40 Line 7',
    sourcePath: 'stateSubtractions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 8: Utah Taxable Income
  {
    pdfFieldName: '40 Line 8',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 9: Tax (4.5%)
  {
    pdfFieldName: '40 Line 9',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 10: Taxpayer Tax Credit (6% of federal std deduction)
  {
    pdfFieldName: '40 Line 10',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const credit = sr.additionalLines?.utTaxpayerCredit || sr.stateCredits || 0;
      return credit > 0 ? Math.round(credit).toString() : '';
    },
  },

  // Line 11: Tax less taxpayer credit
  {
    pdfFieldName: '40 Line 11',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 20: Total Tax
  {
    pdfFieldName: '40 Line 20',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS (Lines 22−33)
  // ═══════════════════════════════════════════════════════════════

  // Line 22: Utah Tax Withheld
  {
    pdfFieldName: '40 Line 22',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 23: Estimated Tax Payments
  {
    pdfFieldName: '40 Line 23',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 33: Total Payments and Credits
  {
    pdfFieldName: '40 Line 33',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const total = sr.stateWithholding + sr.stateEstimatedPayments;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // REFUND / AMOUNT OWED (Lines 34−43)
  // ═══════════════════════════════════════════════════════════════

  // Line 34: Overpayment
  {
    pdfFieldName: '40 Line 34',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 38: Refund
  {
    pdfFieldName: '40 Line 38',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 40: Tax Due
  {
    pdfFieldName: '40 Line 40',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 43: Total Due
  {
    pdfFieldName: '40 Line 43',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const UT_TC40_TEMPLATE: StateFormTemplate = {
  formId: 'ut-tc40',
  stateCode: 'UT',
  displayName: 'TC-40 Utah Individual Income Tax Return',
  pdfFileName: 'ut-tc40.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'UT',
  fields: UT_TC40_FIELDS,
};
