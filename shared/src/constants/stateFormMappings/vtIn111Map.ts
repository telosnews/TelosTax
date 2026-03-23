/**
 * VT IN-111 — Vermont Individual Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 Form IN-111 fillable PDF.
 *
 * VT is a progressive-tax state: 4 brackets (3.35% to 8.75%).
 * Starts from federal taxable income. $4,800 personal exemption.
 * 38% refundable state EITC.
 *
 * PDF field names are descriptive (e.g., "TPFirstName", "Line1", "Line2").
 *
 * PDF: client/public/state-forms/vt-in111.pdf (89 fields)
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const VT_IN111_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: 'TPFirstName',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'TPInit',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'TPLastName',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'TPSSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Spouse
  {
    pdfFieldName: 'SpFirstName',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'SpInit',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseMiddleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'SpLastName',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      if (!tr.spouseLastName || tr.spouseLastName === tr.lastName) return '';
      return tr.spouseLastName.toUpperCase();
    },
  },
  {
    pdfFieldName: 'SpSSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // Address
  {
    pdfFieldName: 'MailingAddress',
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
    pdfFieldName: 'ZIP',
    sourcePath: 'addressZip',
    source: 'taxReturn',
    format: 'string',
  },

  // ═══════════════════════════════════════════════════════════════
  // FILING STATUS (RadioGroup)
  // ═══════════════════════════════════════════════════════════════

  // Note: "Filing Status" is a PDFRadioGroup. The stateFormFiller
  // handles radio groups via transform returning the option value.
  // For now, we leave this as documentation — the filler supports
  // checkbox-based filing status better.

  // ═══════════════════════════════════════════════════════════════
  // INCOME & TAX (Lines 1–16)
  // ═══════════════════════════════════════════════════════════════

  // Line 1: Federal AGI
  {
    pdfFieldName: 'Line1',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 2: Additions
  {
    pdfFieldName: 'Line2',
    sourcePath: 'stateAdditions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 3: Subtractions
  {
    pdfFieldName: 'Line3',
    sourcePath: 'stateSubtractions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 4: Vermont AGI
  {
    pdfFieldName: 'Line4',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 5a: Standard deduction
  {
    pdfFieldName: 'Line5a',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 6: Personal exemptions
  {
    pdfFieldName: 'Line6',
    sourcePath: 'stateExemptions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 7: Taxable income
  {
    pdfFieldName: 'Line7',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 8: VT income tax
  {
    pdfFieldName: 'Line8',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 9: Credits
  {
    pdfFieldName: 'Line9',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const credits = sr.stateCredits;
      return credits > 0 ? Math.round(credits).toString() : '';
    },
  },

  // Line 10: Tax after credits
  {
    pdfFieldName: 'Line10',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 16: Total tax
  {
    pdfFieldName: 'Line16',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS (Lines 17–27)
  // ═══════════════════════════════════════════════════════════════

  // Line 17: VT income tax withheld
  {
    pdfFieldName: 'Line17',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 18: Estimated tax payments
  {
    pdfFieldName: 'Line18',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 19: VT EITC
  {
    pdfFieldName: 'Line19',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const eitc = sr.additionalLines?.stateEITC || 0;
      return eitc > 0 ? Math.round(eitc).toString() : '';
    },
  },

  // Line 25: Total payments and credits
  {
    pdfFieldName: 'Line25',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      // stateCredits are non-refundable (already subtracted on Line 9).
      // Include the refundable VT EITC (Line 19) instead.
      const total = sr.stateWithholding + sr.stateEstimatedPayments + (sr.additionalLines?.stateEITC || 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // REFUND / AMOUNT DUE (Lines 26–32)
  // ═══════════════════════════════════════════════════════════════

  // Line 26a: Overpayment
  {
    pdfFieldName: 'Line26a',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 29: Refund
  {
    pdfFieldName: 'Line29',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 30: Tax due
  {
    pdfFieldName: 'Line30',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 32: Amount due with return
  {
    pdfFieldName: 'Line32',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const VT_IN111_TEMPLATE: StateFormTemplate = {
  formId: 'vt-in111',
  stateCode: 'VT',
  displayName: 'Form IN-111 Vermont Individual Income Tax Return',
  pdfFileName: 'vt-in111.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'VT',
  fields: VT_IN111_FIELDS,
};
