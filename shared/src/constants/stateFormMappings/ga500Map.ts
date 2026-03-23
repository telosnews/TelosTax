/**
 * GA 500 Georgia Individual Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 Form 500 fillable PDF.
 *
 * GA uses federal AGI as starting point. Flat 5.19% rate (HB 111).
 * Standard deduction varies by filing status. $4,000/dependent exemption.
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const GA_500_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: 'TP_FIRSTNAME',
    sourcePath: 'firstName',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'TP_MIDINIT',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'TP_LASTNAME',
    sourcePath: 'lastName',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'TP_SUFFIX',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.suffix || '').toUpperCase(),
  },
  {
    pdfFieldName: 'TP_SSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Spouse
  {
    pdfFieldName: 'SP_FIRSTNAME',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'SP_MIDINIT',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseMiddleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'SP_LASTNAME',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'SP_SUFFIX',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSuffix || '').toUpperCase(),
  },
  {
    pdfFieldName: 'SP_SSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // Address
  {
    pdfFieldName: 'ADDRESS_L1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  {
    pdfFieldName: 'CITY',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressCity || '').toUpperCase(),
  },
  {
    pdfFieldName: 'STATE',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressState || '').toUpperCase(),
  },
  {
    pdfFieldName: 'ZIP5',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.addressZip || '',
  },

  // ═══════════════════════════════════════════════════════════════
  // DEPENDENTS
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: 'L7_DEP1_NAME_INIT',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.dependents?.[0]?.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'L7_DEP1_LASTNAME',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.dependents?.[0]?.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'L7_DEP1_SSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.dependents?.[0]?.ssn || '').replace(/-/g, ''),
  },
  {
    pdfFieldName: 'L7_DEP1_REL',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.dependents?.[0]?.relationship || '',
  },
  {
    pdfFieldName: 'L7_DEP2_NAME_INIT',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.dependents?.[1]?.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'L7_DEP2_LASTNAME',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.dependents?.[1]?.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'L7_DEP2_SSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.dependents?.[1]?.ssn || '').replace(/-/g, ''),
  },
  {
    pdfFieldName: 'L7_DEP2_REL',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.dependents?.[1]?.relationship || '',
  },

  // ═══════════════════════════════════════════════════════════════
  // INCOME & TAX (Lines 8−21)
  // ═══════════════════════════════════════════════════════════════

  // Line 8: Federal AGI
  {
    pdfFieldName: 'L8',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 9: Additions to Income (Schedule 1)
  {
    pdfFieldName: 'L9',
    sourcePath: 'stateAdditions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 10: Subtotal
  {
    pdfFieldName: 'L10',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => Math.round(sr.federalAGI + sr.stateAdditions).toString(),
  },

  // Line 11: Subtractions (Schedule 1)
  {
    pdfFieldName: 'L11',
    sourcePath: 'stateSubtractions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 12A: Georgia AGI
  {
    pdfFieldName: 'L12A',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 13: Standard or Itemized Deduction
  {
    pdfFieldName: 'L13',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 14: Dependent Exemption
  {
    pdfFieldName: 'L14',
    sourcePath: 'stateExemptions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 15A: Georgia Taxable Income
  {
    pdfFieldName: 'L15A',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 16: Georgia Tax (5.19%)
  {
    pdfFieldName: 'L16',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 17: Tax Credits
  {
    pdfFieldName: 'L17',
    sourcePath: 'stateCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 18: Tax after credits
  {
    pdfFieldName: 'L18',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 19: Total local taxes (not modeled)
  {
    pdfFieldName: 'L19',
    sourcePath: 'localTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 20: Use Tax
  {
    pdfFieldName: 'L20',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 21: Total Tax
  {
    pdfFieldName: 'L21',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // WITHHOLDING (W-2 Section)
  // ═══════════════════════════════════════════════════════════════

  // W-2 Box A (first W-2 for GA)
  {
    pdfFieldName: 'WAGES_INCOME_A',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const gaW2s = (tr.w2Income || []).filter(w => (w.state || '').toUpperCase() === 'GA');
      return gaW2s[0]?.stateWages ? Math.round(gaW2s[0].stateWages).toString() : '';
    },
  },
  {
    pdfFieldName: 'TAX_WH_A',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const gaW2s = (tr.w2Income || []).filter(w => (w.state || '').toUpperCase() === 'GA');
      return gaW2s[0]?.stateTaxWithheld ? Math.round(gaW2s[0].stateTaxWithheld).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS & REFUND (Lines 24−37)
  // ═══════════════════════════════════════════════════════════════

  // Line 24: Total GA Tax Withheld
  {
    pdfFieldName: 'L24',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 25: Estimated Tax Payments
  {
    pdfFieldName: 'L25',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 30: Total Payments
  {
    pdfFieldName: 'L30',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const total = sr.stateWithholding + sr.stateEstimatedPayments;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 31: Overpayment
  {
    pdfFieldName: 'L31',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 34: Refund
  {
    pdfFieldName: 'L34',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 36: Amount Due
  {
    pdfFieldName: 'L36',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 37: Total Due (with penalties)
  {
    pdfFieldName: 'L37',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const GA_500_TEMPLATE: StateFormTemplate = {
  formId: 'ga-500',
  stateCode: 'GA',
  displayName: '500 Georgia Individual Income Tax Return',
  pdfFileName: 'ga-500.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'GA',
  fields: GA_500_FIELDS,
};
