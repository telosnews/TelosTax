/**
 * CO DR 0104 Colorado Individual Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 CO DR 0104 fillable PDF.
 *
 * CO starts from federal taxable income (no additional deductions/exemptions).
 * Flat 4.4% rate.
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const CO_104_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  // Taxpayer name
  {
    pdfFieldName: 'Last Name DR 0104',
    sourcePath: 'lastName',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'First Name DR 0104',
    sourcePath: 'firstName',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Middle Initial DR 0104',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Social Security Number DR 0104',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Spouse
  {
    pdfFieldName: 'Spouse Last Name DR 0104',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Spouse First Name DR 0104',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Spouse Middle Initial DR 0104',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseMiddleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Spouse Social Security Number DR 0104',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // Address
  {
    pdfFieldName: 'Physical Street Address DR 0104',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  {
    pdfFieldName: 'City DR 0104',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressCity || '').toUpperCase(),
  },
  {
    pdfFieldName: 'State DR 0104',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressState || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Phone Number DR 0104',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '',
  },

  // ═══════════════════════════════════════════════════════════════
  // INCOME & TAX COMPUTATION (Form 104 Lines)
  // ═══════════════════════════════════════════════════════════════

  // Line 1: Federal Taxable Income (CO starts here)
  {
    pdfFieldName: 'Form Question 1 DR 0104',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const fti = calc.form1040?.taxableIncome || 0;
      return fti > 0 ? Math.round(fti).toString() : '0';
    },
  },

  // Line 2: State Additions (from DR 0104AD)
  {
    pdfFieldName: 'Form Question 2 DR 0104',
    sourcePath: 'stateAdditions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 3: Subtotal (Line 1 + Line 2)
  {
    pdfFieldName: 'Form Question 3 DR 0104',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, calc, sr) => {
      const total = (calc.form1040?.taxableIncome || 0) + sr.stateAdditions;
      return total > 0 ? Math.round(total).toString() : '0';
    },
  },

  // Line 4: State Subtractions (from DR 0104AD)
  {
    pdfFieldName: 'Form Question 4 DR 0104',
    sourcePath: 'stateSubtractions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 5: Colorado Taxable Income (Line 3 − Line 4)
  {
    pdfFieldName: 'Form Question 5 DR 0104',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 6: Colorado Tax (Line 5 × 4.40%)
  {
    pdfFieldName: 'Form Question 6 DR 0104',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 7: Alternative Minimum Tax (not modeled)
  {
    pdfFieldName: 'Form Question 7 DR 0104',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 9: Recapture (not modeled)
  {
    pdfFieldName: 'Form Question 9 DR 0104',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 11: Subtotal of Tax
  {
    pdfFieldName: 'Form Question 11 DR 0104',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 12: State Credits (from DR 0104CR)
  {
    pdfFieldName: 'Form Question 12 DR 0104',
    sourcePath: 'stateCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 13: Net Tax (Line 11 − Line 12)
  {
    pdfFieldName: 'Form Question 13 DR 0104',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS (Lines 24−32)
  // ═══════════════════════════════════════════════════════════════

  // Line 24: CO Income Tax Withheld (W-2 Box 17 for CO)
  {
    pdfFieldName: 'Form Question 24 DR 0104',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 25: Estimated Tax Payments
  {
    pdfFieldName: 'Form Question 25 DR 0104',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 32: Total Payments and Credits
  {
    pdfFieldName: 'Form Question 32 DR 0104',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      // stateCredits are non-refundable (already subtracted to produce stateTaxAfterCredits).
      const total = sr.stateWithholding + sr.stateEstimatedPayments;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // REFUND / AMOUNT OWED (Lines 34−47)
  // ═══════════════════════════════════════════════════════════════

  // Line 34: Overpayment
  {
    pdfFieldName: 'Form Question 34 DR 0104',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 35: Amount applied to estimated tax
  {
    pdfFieldName: 'Form Question 35 DR 0104',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 36: Donations
  {
    pdfFieldName: 'Form Question 36 DR 0104',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 37: Total
  {
    pdfFieldName: 'Form Question 37 DR 0104',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 38: Net Overpayment / Refund
  {
    pdfFieldName: 'Form Question 38 DR 0104',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 40: Amount Owed
  {
    pdfFieldName: 'Form Question 40 DR 0104',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 47: Total Due
  {
    pdfFieldName: 'Form Question 47 DR 0104',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // DEPENDENTS (Page 1 Section C)
  // ═══════════════════════════════════════════════════════════════
  {
    pdfFieldName: 'Last Name Dependent 1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.dependents?.[0]?.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'First Name Dependent 1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.dependents?.[0]?.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Social Security Number Dependent 1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.dependents?.[0]?.ssn || '').replace(/-/g, ''),
  },
];

// ─── Template ────────────────────────────────────────────────────

export const CO_104_TEMPLATE: StateFormTemplate = {
  formId: 'co-104',
  stateCode: 'CO',
  displayName: 'DR 0104 Colorado Individual Income Tax Return',
  pdfFileName: 'co-104.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'CO',
  fields: CO_104_FIELDS,
};
