/**
 * HI N-11 Hawaii Resident Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 Hawaii Form N-11 fillable PDF.
 *
 * HI N-11 AcroForm fields use short alphanumeric codes (e.g., "A1", "B1", "A14").
 * Field codes were correlated with the N-11 form lines via the extracted PDF.
 */
import type { TaxReturn, CalculationResult, StateCalculationResult } from '../../types/index.js';
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const HI_N11_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information (Section A & B)
  // ═══════════════════════════════════════════════════════════════

  // B1: Your first name
  {
    pdfFieldName: 'B1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  // B2: Your middle initial
  {
    pdfFieldName: 'B2',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  // B3: Your last name
  {
    pdfFieldName: 'B3',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  // B4: Your SSN
  {
    pdfFieldName: 'B4',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },
  // B5: Spouse first name
  {
    pdfFieldName: 'B5',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  // B6: Spouse last name
  {
    pdfFieldName: 'B6',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || '').toUpperCase(),
  },

  // A1: Present mailing address (street)
  {
    pdfFieldName: 'A1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  // A5: City
  {
    pdfFieldName: 'A5',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressCity || '').toUpperCase(),
  },
  // A6: State
  {
    pdfFieldName: 'A6',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressState || '').toUpperCase(),
  },
  // A7: ZIP code
  {
    pdfFieldName: 'A7',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.addressZip || '',
  },

  // ═══════════════════════════════════════════════════════════════
  // INCOME LINES (Section A, Lines 14-37)
  // ═══════════════════════════════════════════════════════════════

  // A14: Wages, salaries, tips
  {
    pdfFieldName: 'A14',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.w2Income || []).reduce((sum, w) => sum + (w.wages || 0), 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // A15: Taxable interest
  {
    pdfFieldName: 'A15',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.income1099INT || []).reduce((sum, i) => sum + (i.amount || 0), 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // A17: Ordinary dividends
  {
    pdfFieldName: 'A17',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.income1099DIV || []).reduce((sum, d) => sum + (d.ordinaryDividends || 0), 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // A32: Federal AGI
  {
    pdfFieldName: 'A32',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // A33: HI additions
  {
    pdfFieldName: 'A33',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateAdditions > 0 ? Math.round(sr.stateAdditions).toString() : '';
    },
  },

  // A35: HI subtractions
  {
    pdfFieldName: 'A35',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateSubtractions > 0 ? Math.round(sr.stateSubtractions).toString() : '';
    },
  },

  // A37: HI AGI
  {
    pdfFieldName: 'A37',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // DEDUCTIONS & EXEMPTIONS (Lines 39-43)
  // ═══════════════════════════════════════════════════════════════

  // A39: Standard deduction
  {
    pdfFieldName: 'A39',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // A42: Exemptions
  {
    pdfFieldName: 'A42',
    sourcePath: 'stateExemptions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // A43: HI taxable income
  {
    pdfFieldName: 'A43',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // TAX COMPUTATION (Lines 44-52)
  // ═══════════════════════════════════════════════════════════════

  // A44: Tax on taxable income
  {
    pdfFieldName: 'A44',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // A47: Total tax
  {
    pdfFieldName: 'A47',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // A48: HI tax withheld
  {
    pdfFieldName: 'A48',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // A49: Estimated tax payments
  {
    pdfFieldName: 'A49',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // A50: Food/excise tax credit
  {
    pdfFieldName: 'A50',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const credit = sr.additionalLines?.foodExciseCredit || 0;
      return credit > 0 ? Math.round(credit).toString() : '';
    },
  },

  // A51: Total payments and credits
  {
    pdfFieldName: 'A51',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      // stateCredits are non-refundable (already subtracted on A47).
      // Include the refundable food/excise credit (A50) instead.
      const total = sr.stateWithholding + sr.stateEstimatedPayments + (sr.additionalLines?.foodExciseCredit || 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // A52: Overpayment / refund
  {
    pdfFieldName: 'A52',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // A521: Amount owed
  {
    pdfFieldName: 'A521',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const HI_N11_TEMPLATE: StateFormTemplate = {
  formId: 'hi-n11',
  stateCode: 'HI',
  displayName: 'Form N-11 Hawaii Resident Income Tax Return',
  pdfFileName: 'hi-n11.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'HI',
  fields: HI_N11_FIELDS,
};
