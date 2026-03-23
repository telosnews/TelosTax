/**
 * VA Form 760 — Virginia Resident Individual Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 Form 760 fillable PDF.
 *
 * VA is a progressive-tax state: 4 brackets (2% to 5.75%).
 * $930 personal exemption, $930 dependent exemption.
 * 20% refundable state EITC.
 *
 * PDF: client/public/state-forms/va-760.pdf (114 fields)
 * Enumerated via: npx tsx scripts/enumerate-pdf-fields.ts client/public/state-forms/va-760.pdf
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const VA_760_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: 'Your Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Middle initial',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Last name including suffix',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Your SSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Spouse
  {
    pdfFieldName: 'Spouse Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Middle initial_2',
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
    pdfFieldName: 'City, Town OR Post Office',
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
    pdfFieldName: 'Zip Code',
    sourcePath: 'addressZip',
    source: 'taxReturn',
    format: 'string',
  },

  // ═══════════════════════════════════════════════════════════════
  // EXEMPTIONS
  // ═══════════════════════════════════════════════════════════════

  // Dependents count
  {
    pdfFieldName: 'Dependents',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const count = (tr.dependents || []).length;
      return count > 0 ? count.toString() : '';
    },
  },

  // Total exemptions count (yourself + spouse + dependents)
  {
    pdfFieldName: 'Total Exemptions Section A',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      let count = 1; // Yourself
      if (tr.filingStatus === 2) count = 2; // MFJ: + spouse
      count += (tr.dependents || []).length;
      return count.toString();
    },
  },

  // Total exemptions dollar amount ($930 per exemption)
  {
    pdfFieldName: 'Total Exemptions Dollar Amount Section A',
    sourcePath: 'stateExemptions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // INCOME & TAX (Lines 1–18)
  // ═══════════════════════════════════════════════════════════════

  // Line 1: Federal AGI
  {
    pdfFieldName: '1. Federal Adjusted Gross Income',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 2: Additions (from Schedule ADJ)
  {
    pdfFieldName: '2. Additions',
    sourcePath: 'stateAdditions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 3: Total (FAGI + additions)
  {
    pdfFieldName: '3. Add Lines 1 and 2',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => Math.round(sr.federalAGI + sr.stateAdditions).toString(),
  },

  // Line 7: Subtractions
  {
    pdfFieldName: '7. Subtractions',
    sourcePath: 'stateSubtractions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 9: VA AGI
  {
    pdfFieldName: '9. Virginia Adjusted Gross Income',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 11: Standard Deduction
  {
    pdfFieldName: '11. Standard Deduction',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 12: Total Exemptions (dollar amount from Section A + B)
  {
    pdfFieldName: '12. Total Exemptions Section A plus Section B above',
    sourcePath: 'stateExemptions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 14: Total deductions + exemptions
  {
    pdfFieldName: '14. Add Lines 10,11, 12 and 13',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => Math.round(sr.stateDeduction + sr.stateExemptions).toString(),
  },

  // Line 15: VA taxable income
  {
    pdfFieldName: '15. Virginia Taxable income',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // SSN on page 2
  {
    pdfFieldName: 'SSN 1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Line 16: Tax from tables
  {
    pdfFieldName: '16. Amount of tax',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 18: Net Amount of Tax
  {
    pdfFieldName: '18. Net Amount of Tax',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS (Lines 19–26)
  // ═══════════════════════════════════════════════════════════════

  // Line 19a: Your VA tax withheld
  {
    pdfFieldName: '19a Your Virginia Witholding',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 20: Estimated payments
  {
    pdfFieldName: '20. Estimated Payments Made',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 23: EITC (20% refundable)
  {
    pdfFieldName: '23. Tax Credit for Low Income or Earned Income',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const eitc = sr.additionalLines?.stateEITC || 0;
      return eitc > 0 ? Math.round(eitc).toString() : '';
    },
  },

  // Line 26: Total payments
  {
    pdfFieldName: '26. Add Lines 19a Through 25',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      // stateCredits are non-refundable (already subtracted on Line 18).
      // Include the refundable VA EITC (Line 23) instead.
      const total = sr.stateWithholding + sr.stateEstimatedPayments + (sr.additionalLines?.stateEITC || 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // REFUND / AMOUNT OWED (Lines 27–36)
  // ═══════════════════════════════════════════════════════════════

  // Line 27: Tax due
  {
    pdfFieldName: '27. Tax you owe',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 28: Overpayment
  {
    pdfFieldName: '28. Overpayment',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 35: Amount you owe (with penalties)
  {
    pdfFieldName: '35. Amount You Owe',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 36: Refund
  {
    pdfFieldName: '36. Your Refund',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const VA_760_TEMPLATE: StateFormTemplate = {
  formId: 'va-760',
  stateCode: 'VA',
  displayName: 'Form 760 Virginia Resident Individual Income Tax Return',
  pdfFileName: 'va-760.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'VA',
  fields: VA_760_FIELDS,
};
