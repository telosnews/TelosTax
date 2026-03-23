/**
 * MI-1040 Michigan Individual Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the 2025 MI-1040 fillable PDF.
 *
 * MI uses federal AGI as starting point. Flat 4.25% rate.
 * Personal exemption: $5,800/person (taxpayer + spouse + dependents).
 *
 * Real PDF field names include: FSSN1, SpSSN1, "Filer's First Name",
 * "Home address", "Line 10", etc.
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const MI_1040_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: "Filer's First Name",
    sourcePath: 'firstName',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: "Filer's Initial",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: "Filer's Last Name",
    sourcePath: 'lastName',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  // SSN split across 3 fields (FSSN1: first 3, FSSN2: middle 2, FSSN3: last 4)
  {
    pdfFieldName: 'FSSN1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const ssn = (tr.ssn || '').replace(/-/g, '');
      return ssn.length >= 3 ? ssn.substring(0, 3) : '';
    },
  },
  {
    pdfFieldName: 'FSSN2',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const ssn = (tr.ssn || '').replace(/-/g, '');
      return ssn.length >= 5 ? ssn.substring(3, 5) : '';
    },
  },
  {
    pdfFieldName: 'FSSN3',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const ssn = (tr.ssn || '').replace(/-/g, '');
      if (ssn.length >= 9) return ssn.substring(5, 9);
      // Fall back to last four
      return (tr.ssnLastFour || '').replace(/-/g, '');
    },
  },

  // Spouse
  {
    pdfFieldName: "Spouse's First Name",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  {
    pdfFieldName: "Spouse's Initial",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseMiddleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: "Spouse's Last Name",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || tr.lastName || '').toUpperCase(),
  },
  // Spouse SSN split across 3 fields
  {
    pdfFieldName: 'SpSSN1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const ssn = (tr.spouseSsn || '').replace(/-/g, '');
      return ssn.length >= 3 ? ssn.substring(0, 3) : '';
    },
  },
  {
    pdfFieldName: 'SpSSN2',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const ssn = (tr.spouseSsn || '').replace(/-/g, '');
      return ssn.length >= 5 ? ssn.substring(3, 5) : '';
    },
  },
  {
    pdfFieldName: 'SpSSN3',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const ssn = (tr.spouseSsn || '').replace(/-/g, '');
      if (ssn.length >= 9) return ssn.substring(5, 9);
      return (tr.spouseSsnLastFour || '').replace(/-/g, '');
    },
  },

  // Address
  {
    pdfFieldName: 'Home address',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  {
    pdfFieldName: 'City or town',
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
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.addressZip || '',
  },

  // ═══════════════════════════════════════════════════════════════
  // FILING STATUS & EXEMPTIONS
  // ═══════════════════════════════════════════════════════════════

  // Line 7a: Single
  {
    pdfFieldName: 'Line 7a Single Checkbox',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 1,
  },
  // Line 7b: MFJ
  {
    pdfFieldName: 'Line 7b Checkbox',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 2,
  },
  // Line 7c: MFS
  {
    pdfFieldName: 'Line 7c Checkbox',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 3,
  },

  // Line 8a: Resident
  {
    pdfFieldName: 'Line 8a Resident Chceckbox',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: () => true, // Default to resident
  },

  // Line 9a: Filer personal exemption (number)
  {
    pdfFieldName: 'Line 9a Number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '1',
  },
  // Line 9b: Spouse exemption count
  {
    pdfFieldName: 'Line 9b Numbers',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.filingStatus === 2 || tr.filingStatus === 3) ? '1' : '',
  },
  // Line 9c: Dependent exemption count
  {
    pdfFieldName: 'Line 9c Number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const count = (tr.dependents || []).length;
      return count > 0 ? count.toString() : '';
    },
  },
  // Line 9f: Total exemptions (dollar amount)
  {
    pdfFieldName: 'Line 9f',
    sourcePath: 'stateExemptions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // INCOME & TAX (Lines 10-20)
  // ═══════════════════════════════════════════════════════════════

  // Line 10: Adjusted Gross Income from federal return
  {
    pdfFieldName: 'Line 10',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 11: Additions
  {
    pdfFieldName: 'Line 11',
    sourcePath: 'stateAdditions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 12: Total Income (Line 10 + Line 11)
  {
    pdfFieldName: 'Line 12',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => Math.round(sr.federalAGI + sr.stateAdditions).toString(),
  },

  // Line 13: Subtractions
  {
    pdfFieldName: 'Line 13',
    sourcePath: 'stateSubtractions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 14: Income Subject to Tax
  {
    pdfFieldName: 'Line 14',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 15: Personal Exemption Allowance
  {
    pdfFieldName: 'Line 15',
    sourcePath: 'stateExemptions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 16: Taxable Income
  {
    pdfFieldName: 'Line 16',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 17: Tax (4.25%)
  {
    pdfFieldName: 'Line 17',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 18a: Credits (nonrefundable)
  {
    pdfFieldName: 'Line 18a',
    sourcePath: 'stateCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 19a: Use Tax (not modeled)
  {
    pdfFieldName: 'Line 19a',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 19b: Voluntary contributions (not modeled)
  {
    pdfFieldName: 'Line 19b',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 20a: Total Tax
  {
    pdfFieldName: 'Line 20a',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS & REFUND (Lines 21-39)
  // ═══════════════════════════════════════════════════════════════

  // Line 21: MI Tax Withheld
  {
    pdfFieldName: 'Line 21',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 22: Estimated Tax Payments
  {
    pdfFieldName: 'Line 22',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 27: Total Payments
  {
    pdfFieldName: 'Line 27',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const total = sr.stateWithholding + sr.stateEstimatedPayments;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 29: Overpayment
  {
    pdfFieldName: 'Line 29',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 34: Refund
  {
    pdfFieldName: 'Line 34',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 37: Amount You Owe
  {
    pdfFieldName: 'Line 37',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 39: Total Amount Due
  {
    pdfFieldName: 'Line 39',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const MI_1040_TEMPLATE: StateFormTemplate = {
  formId: 'mi-1040',
  stateCode: 'MI',
  displayName: 'MI-1040 Michigan Individual Income Tax Return',
  pdfFileName: 'mi-1040.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'MI',
  fields: MI_1040_FIELDS,
};
