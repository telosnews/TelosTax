/**
 * SC Form SC1040 — South Carolina Individual Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 SC1040 fillable PDF.
 *
 * SC is a progressive-tax state: 3 brackets (0% / 3% / 6.4%).
 * Starts from federal taxable income (not AGI).
 *
 * PDF: client/public/state-forms/sc-1040.pdf (43 fields)
 */
import type { TaxReturn, CalculationResult, StateCalculationResult } from '../../types/index.js';
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const SC_1040_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // PAGE 1 — Identity
  // ═══════════════════════════════════════════════════════════════

  // SSN (primary filer)
  {
    pdfFieldName: 'Your SSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Spouse SSN
  {
    pdfFieldName: 'Spouse SSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // Taxpayer name — First Name + MI combined in one field
  {
    pdfFieldName: 'First Name MI',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const first = (tr.firstName || '').toUpperCase();
      const mi = (tr.middleInitial || '').toUpperCase();
      return mi ? `${first} ${mi}` : first;
    },
  },
  {
    pdfFieldName: 'Last Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Suffix',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '', // Suffix not modeled in TaxReturn
  },

  // Spouse name
  {
    pdfFieldName: 'Spouse First Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Spouse Last Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Spouse Suffix',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '', // Suffix not modeled
  },

  // Address
  {
    pdfFieldName: 'Mailing Address',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  {
    pdfFieldName: 'County Code',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '', // County code not modeled in TaxReturn
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
  {
    pdfFieldName: 'Phone',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '', // Phone not modeled in TaxReturn
  },

  // Dependents & age info
  {
    pdfFieldName: 'Num Federal Deps',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const count = (tr.dependents || []).length;
      return count > 0 ? count.toString() : '';
    },
  },
  {
    pdfFieldName: 'Num Deps Under 6',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '', // Age-specific dependent count not modeled
  },
  {
    pdfFieldName: 'Num Taxpayers 65+',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '', // Age-specific taxpayer count not modeled
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 2 — Income Lines 1–10
  // ═══════════════════════════════════════════════════════════════

  // Page 2 header SSN
  {
    pdfFieldName: 'Page 2 SSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Line 1: Federal taxable income (SC starts from this, not AGI)
  {
    pdfFieldName: 'Line 1',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, calc: CalculationResult) =>
      Math.round(calc.form1040.taxableIncome || 0).toString(),
  },

  // Line 2a: State tax addback (addition)
  {
    pdfFieldName: 'Line 2a',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Individual addition line — not separately modeled
  },

  // Line 2: Total additions
  {
    pdfFieldName: 'Line 2',
    sourcePath: 'stateAdditions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 3: Line 1 + Line 2
  {
    pdfFieldName: 'Line 3',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, calc: CalculationResult, sr: StateCalculationResult) => {
      const fedTaxable = Math.round(calc.form1040.taxableIncome || 0);
      const additions = Math.round(sr.stateAdditions);
      return (fedTaxable + additions).toString();
    },
  },

  // Line 4f: State tax refund subtraction
  {
    pdfFieldName: 'Line 4f',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Individual subtraction line — not separately modeled
  },

  // Line 4o: Social security subtraction
  {
    pdfFieldName: 'Line 4o',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Individual subtraction line — not separately modeled
  },

  // Line 4w: SC dependent exemption
  {
    pdfFieldName: 'Line 4w',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Individual subtraction line — not separately modeled
  },

  // Line 4: Total subtractions
  {
    pdfFieldName: 'Line 4',
    sourcePath: 'stateSubtractions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 5: SC income subject to tax (Line 3 - Line 4)
  {
    pdfFieldName: 'Line 5',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 6: Tax on SC income (from tax brackets)
  {
    pdfFieldName: 'Line 6',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 10: Total SC tax
  {
    pdfFieldName: 'Line 10',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 3 — Credits & Payments Lines 11–34
  // ═══════════════════════════════════════════════════════════════

  // Page 3 header SSN
  {
    pdfFieldName: 'Page 3 SSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Line 11: Child/dependent care credit (not modeled)
  {
    pdfFieldName: 'Line 11',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Child/dependent care credit — not implemented
  },

  // Line 14: Total nonrefundable credits
  {
    pdfFieldName: 'Line 14',
    sourcePath: 'stateCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 15: Tax minus credits
  {
    pdfFieldName: 'Line 15',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 16: SC withholding
  {
    pdfFieldName: 'Line 16',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 17: Estimated payments
  {
    pdfFieldName: 'Line 17',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 18: Extension payment (not modeled)
  {
    pdfFieldName: 'Line 18',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Extension payment — not implemented
  },

  // Line 22: Total refundable credits (not modeled)
  {
    pdfFieldName: 'Line 22',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Refundable credits — not implemented
  },

  // Line 23: Total payments (withholding + estimated)
  {
    pdfFieldName: 'Line 23',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      const total = sr.stateWithholding + sr.stateEstimatedPayments;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 24: Overpayment (if refund owed to taxpayer)
  {
    pdfFieldName: 'Line 24',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 25: Amount due (if taxpayer owes)
  {
    pdfFieldName: 'Line 25',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 30: Refund (same as overpayment)
  {
    pdfFieldName: 'Line 30',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 31: Tax due (same as amount due)
  {
    pdfFieldName: 'Line 31',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 34: Balance due (same as amount due)
  {
    pdfFieldName: 'Line 34',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const SC_1040_TEMPLATE: StateFormTemplate = {
  formId: 'sc-1040',
  stateCode: 'SC',
  displayName: 'SC1040 South Carolina Individual Income Tax Return',
  pdfFileName: 'sc-1040.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'SC',
  fields: SC_1040_FIELDS,
};
