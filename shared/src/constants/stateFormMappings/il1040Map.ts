/**
 * IL-1040 Illinois Individual Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 IL-1040 fillable PDF.
 *
 * IL uses federal AGI as starting point. Flat 4.95% rate.
 * Per-person exemption of $2,850 (taxpayer + spouse + dependents).
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const IL_1040_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // STEP 1 — Personal Information
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: 'step1-A-firstnamemi',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.firstName || '', tr.middleInitial || ''].filter(Boolean);
      return parts.join(' ').toUpperCase();
    },
  },
  {
    pdfFieldName: 'step1-A-lastname',
    sourcePath: 'lastName',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'step1-A-ssn',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },
  {
    pdfFieldName: 'step1-A-spousefirstnamemi',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.spouseFirstName || '', tr.spouseMiddleInitial || ''].filter(Boolean);
      return parts.join(' ').toUpperCase();
    },
  },
  {
    pdfFieldName: 'step1-A-spouselastname',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'step1-A-spousessn',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // Address
  {
    pdfFieldName: 'step1-A-mailingaddress',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  {
    pdfFieldName: 'step1-A-city',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressCity || '').toUpperCase(),
  },
  {
    pdfFieldName: 'step1-A-state',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressState || '').toUpperCase(),
  },
  {
    pdfFieldName: 'step1-A-zip',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.addressZip || '',
  },

  // ═══════════════════════════════════════════════════════════════
  // STEP 3 — Base Income (Lines 1−9)
  // ═══════════════════════════════════════════════════════════════

  // Line 1: Federal Adjusted Gross Income
  {
    pdfFieldName: 'Federally adjusted income',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 4: Total Income (after additions)
  {
    pdfFieldName: 'Total income',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const total = sr.federalAGI + sr.stateAdditions;
      return Math.round(total).toString();
    },
  },

  // Line 8: Total of Subtractions
  {
    pdfFieldName: 'Total of your subtractions',
    sourcePath: 'stateSubtractions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 9: Illinois Base Income (Line 4 − Line 8)
  {
    pdfFieldName: 'Illinois base income',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // STEP 4 — Exemptions (Line 10)
  // ═══════════════════════════════════════════════════════════════

  // Number of dependents
  {
    pdfFieldName: 'Claiming dependents',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const count = (tr.dependents || []).length;
      return count > 0 ? count.toString() : '';
    },
  },

  // Line 10: Exemption Allowance
  {
    pdfFieldName: 'Exemption allowance',
    sourcePath: 'stateExemptions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // STEP 5 — Tax Computation (Lines 11−15)
  // ═══════════════════════════════════════════════════════════════

  // Line 14: Income Tax (4.95%)
  {
    pdfFieldName: 'Income tax',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 17: Total Credits
  {
    pdfFieldName: 'Total of your credits',
    sourcePath: 'stateCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 18: Tax After Nonrefundable Credits
  {
    pdfFieldName: 'Tax after nonrefundable credits',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 22: Total Tax
  {
    pdfFieldName: 'Total Tax',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // STEP 7 — Payments (Lines 23−31)
  // ═══════════════════════════════════════════════════════════════

  // Line 23: Total Tax from Page 1
  {
    pdfFieldName: 'Total tax from Page 1',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 25: IL Income Tax Withheld
  {
    pdfFieldName: 'Illinois Income Tax withheld',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 26: Estimated Payments
  {
    pdfFieldName: 'Estimated payments',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 31: Total Payments and Refundable Credits
  {
    pdfFieldName: 'Total payments and refundable credit',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const total = sr.stateWithholding + sr.stateEstimatedPayments;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // STEP 8 — Refund / Amount Owed (Lines 32−38)
  // ═══════════════════════════════════════════════════════════════

  // Line 32: Overpayment (if Line 31 > Line 23)
  {
    pdfFieldName: 'If Line 31 is greater',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 33: Amount Owed (if Line 23 > Line 31)
  {
    pdfFieldName: 'If Line 24 is greater',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 36: Refund
  {
    pdfFieldName: 'Refunded to you',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 38: Amount You Owe
  {
    pdfFieldName: 'Amount you owe',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const IL_1040_TEMPLATE: StateFormTemplate = {
  formId: 'il-1040',
  stateCode: 'IL',
  displayName: 'IL-1040 Illinois Individual Income Tax Return',
  pdfFileName: 'il-1040.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'IL',
  fields: IL_1040_FIELDS,
};
