/**
 * KY 740 Kentucky Individual Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 Form 740 fillable PDF.
 *
 * KY uses federal AGI as starting point. Flat 4.0% rate.
 * Standard deduction: $3,270 for all filing statuses.
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const KY_740_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: '740Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.firstName, tr.middleInitial, tr.lastName].filter(Boolean);
      if (tr.spouseFirstName) {
        parts.push('&', tr.spouseFirstName, tr.spouseLastName || tr.lastName || '');
      }
      return parts.join(' ').toUpperCase();
    },
  },

  {
    pdfFieldName: '740PrimarySSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  {
    pdfFieldName: '740SpouseSSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // Spouse name for MFS Line 4
  {
    pdfFieldName: '740SFS4SpouseName',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      if (!tr.spouseFirstName) return '';
      return [tr.spouseFirstName, tr.spouseLastName || tr.lastName].filter(Boolean).join(' ').toUpperCase();
    },
  },

  // Address
  {
    pdfFieldName: '740StreetAddress2',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  {
    pdfFieldName: '740City',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressCity || '').toUpperCase(),
  },
  {
    pdfFieldName: '740State',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressState || '').toUpperCase(),
  },
  {
    pdfFieldName: '740Zip',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.addressZip || '',
  },
  {
    pdfFieldName: '740DaytimePhoneNum',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '',
  },

  // ═══════════════════════════════════════════════════════════════
  // INCOME SECTION (Lines 5−11)
  // ═══════════════════════════════════════════════════════════════

  // Line 5A: Wages (from W-2)
  {
    pdfFieldName: '740Line5A',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.w2Income || []).reduce((sum, w) => sum + (w.wages || 0), 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 7A: Interest Income
  {
    pdfFieldName: '740Line7A',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.income1099INT || []).reduce((sum, i) => sum + (i.amount || 0), 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 8A: Dividend Income
  {
    pdfFieldName: '740Line8A',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.income1099DIV || []).reduce((sum, d) => sum + (d.ordinaryDividends || 0), 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 9A: Federal AGI
  {
    pdfFieldName: '740Line9A',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 10A: Kentucky Additions
  {
    pdfFieldName: '740Line10A',
    sourcePath: 'stateAdditions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 11A: Subtotal (Line 9 + Line 10)
  {
    pdfFieldName: '740Line11A',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => Math.round(sr.federalAGI + sr.stateAdditions).toString(),
  },

  // Line 12A: Subtractions
  {
    pdfFieldName: '740Line12A',
    sourcePath: 'stateSubtractions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 13A: Kentucky AGI
  {
    pdfFieldName: '740Line13A',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // DEDUCTIONS & TAX (Lines 14−22)
  // ═══════════════════════════════════════════════════════════════

  // Line 14A: Standard Deduction ($3,270)
  {
    pdfFieldName: '740Line14A',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 15A: Taxable Income
  {
    pdfFieldName: '740Line15A',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 16A: Tax (4.0%)
  {
    pdfFieldName: '740Line16A',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 19: Total Tax
  {
    pdfFieldName: '740Line19',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 22: Tax after Credits
  {
    pdfFieldName: '740Line22',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS & REFUND (Lines 26−41)
  // ═══════════════════════════════════════════════════════════════

  // Line 26: Kentucky Income Tax Withheld
  {
    pdfFieldName: '740Line26',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 27: Estimated Tax Payments
  {
    pdfFieldName: '740Line27',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 33: Total Payments
  {
    pdfFieldName: '740Line33',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const total = sr.stateWithholding + sr.stateEstimatedPayments;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 35: Overpayment
  {
    pdfFieldName: '740Line35',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 36: Refund
  {
    pdfFieldName: '740Line36',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 40: Amount Due
  {
    pdfFieldName: '740Line40',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 41: Total Due
  {
    pdfFieldName: '740Line41',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const KY_740_TEMPLATE: StateFormTemplate = {
  formId: 'ky-740',
  stateCode: 'KY',
  displayName: '740 Kentucky Individual Income Tax Return',
  pdfFileName: 'ky-740.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'KY',
  fields: KY_740_FIELDS,
};
