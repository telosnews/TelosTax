/**
 * MO Form MO-1040 — Missouri Individual Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 MO-1040 fillable PDF.
 *
 * MO is a progressive-tax state: 7 brackets (2% to 4.7%).
 * Starts from federal AGI. Federal standard deduction conformity.
 * $1,200 dependent exemption. 20% non-refundable state EITC.
 *
 * PDF: client/public/state-forms/mo-1040.pdf (192 fields)
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const MO_1040_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: 'First Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'MI',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Last Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Social Security Number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Spouse
  {
    pdfFieldName: 'Spouses First Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'MI_2',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseMiddleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Spouses Last Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Spouses Social Security Number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // Address
  {
    pdfFieldName: 'Present Address Include Apartment Number or Rural Route',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  {
    pdfFieldName: 'City Town or Post Office',
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
    pdfFieldName: 'ZIP Code',
    sourcePath: 'addressZip',
    source: 'taxReturn',
    format: 'string',
  },

  // ═══════════════════════════════════════════════════════════════
  // FILING STATUS
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: 'Single',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 1,
  },
  {
    pdfFieldName: 'Married Filing',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 2, // MFJ
  },
  {
    pdfFieldName: 'Married Filing_2',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 3, // MFS
  },
  {
    pdfFieldName: 'Head of',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 4, // HoH
  },

  // ═══════════════════════════════════════════════════════════════
  // DEPENDENTS (Lines 1Y–6)
  // ═══════════════════════════════════════════════════════════════

  // Yourself
  {
    pdfFieldName: '1Y',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '1',
  },

  // Spouse (MFJ only)
  {
    pdfFieldName: '1S',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.filingStatus === 2 ? '1' : '',
  },

  // Dependents
  {
    pdfFieldName: '6',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      let total = 1; // Yourself
      if (tr.filingStatus === 2) total += 1; // Spouse
      total += (tr.dependents || []).length;
      return total.toString();
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // INCOME & TAX (Lines 7–26)
  // ═══════════════════════════════════════════════════════════════

  // Line 7Y: Federal AGI (your portion)
  {
    pdfFieldName: '7Y',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 8: Missouri additions
  {
    pdfFieldName: '8',
    sourcePath: 'stateAdditions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 9: Subtotal
  {
    pdfFieldName: '9',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => Math.round(sr.federalAGI + sr.stateAdditions).toString(),
  },

  // Line 10: Missouri subtractions
  {
    pdfFieldName: '10',
    sourcePath: 'stateSubtractions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 11: MO AGI
  {
    pdfFieldName: '11',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 12: Deduction (standard or itemized)
  {
    pdfFieldName: '12',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 13: MO taxable income
  {
    pdfFieldName: '13',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 14: Tax from tables
  {
    pdfFieldName: '14',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 15: Dependent deduction
  {
    pdfFieldName: '15',
    sourcePath: 'stateExemptions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 16: Tax after dependent deduction
  {
    pdfFieldName: '16',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return Math.round(Math.max(0, sr.stateIncomeTax - sr.stateExemptions)).toString();
    },
  },

  // Line 22: Credits
  {
    pdfFieldName: '22',
    sourcePath: 'stateCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 23: Tax after credits
  {
    pdfFieldName: '23',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 25: MO EITC (20% nonrefundable)
  {
    pdfFieldName: '25',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const eitc = sr.additionalLines?.stateEITC || 0;
      return eitc > 0 ? Math.round(eitc).toString() : '';
    },
  },

  // Line 26: Balance (total tax)
  {
    pdfFieldName: '26',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS (Lines 36–45)
  // ═══════════════════════════════════════════════════════════════

  // Line 36: MO tax withheld
  {
    pdfFieldName: '36',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 37: Estimated tax payments
  {
    pdfFieldName: '37',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 40: Total payments
  {
    pdfFieldName: '40',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const total = sr.stateWithholding + sr.stateEstimatedPayments;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // REFUND / AMOUNT OWED (Lines 41–45)
  // ═══════════════════════════════════════════════════════════════

  // Line 41: Overpayment
  {
    pdfFieldName: '41',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 42: Tax due
  {
    pdfFieldName: '42',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 44: Refund
  {
    pdfFieldName: '44',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 45: Amount you owe
  {
    pdfFieldName: '45',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const MO_1040_TEMPLATE: StateFormTemplate = {
  formId: 'mo-1040',
  stateCode: 'MO',
  displayName: 'Form MO-1040 Missouri Individual Income Tax Return',
  pdfFileName: 'mo-1040.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'MO',
  fields: MO_1040_FIELDS,
};
