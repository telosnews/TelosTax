/**
 * ID Form 40 — Idaho Individual Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 Form 40 fillable PDF.
 *
 * ID is a progressive-tax state: 2 brackets (0% + 5.3%).
 * Starts from federal AGI. $0 personal exemption, $0 dependent exemption.
 * Grocery credit via hooks.
 *
 * PDF field names are a mix of descriptive names (FirstName1, IncomeL7, etc.)
 * and form-section prefixed names (TxCompL13, CreditsL21, etc.).
 *
 * PDF: client/public/state-forms/id-40.pdf (793 fields, many worksheets)
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const ID_40_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  // First name
  {
    pdfFieldName: 'FirstName1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.firstName, tr.middleInitial].filter(Boolean);
      return parts.join(' ').toUpperCase();
    },
  },
  // Initial
  {
    pdfFieldName: 'Initial1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  // Last name
  {
    pdfFieldName: 'LastName1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  // SSN
  {
    pdfFieldName: 'SSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Spouse
  {
    pdfFieldName: 'FirstName2',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'MiddleInitial2',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseMiddleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'LastName2',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      if (!tr.spouseLastName || tr.spouseLastName === tr.lastName) return '';
      return tr.spouseLastName.toUpperCase();
    },
  },
  {
    pdfFieldName: 'SpouseSSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // Address
  {
    pdfFieldName: 'City',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressCity || '').toUpperCase(),
  },
  {
    pdfFieldName: 'StateAbbrv',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressState || '').toUpperCase(),
  },

  // ═══════════════════════════════════════════════════════════════
  // FILING STATUS
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: 'FilingStatusSingle',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 1,
  },
  {
    pdfFieldName: 'FilingStatusMarriedJoint',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 2,
  },
  {
    pdfFieldName: 'FilingStatusMarriedSeparate',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 3,
  },
  {
    pdfFieldName: 'FilingStatusHead',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 4,
  },
  {
    pdfFieldName: 'FilingStatusQualifying',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 5,
  },

  // ═══════════════════════════════════════════════════════════════
  // INCOME (Lines 7–11)
  // ═══════════════════════════════════════════════════════════════

  // Line 7: Federal AGI
  {
    pdfFieldName: 'IncomeL7',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 8: State additions
  {
    pdfFieldName: 'IncomeL8',
    sourcePath: 'stateAdditions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 9: Total income (AGI + additions)
  {
    pdfFieldName: 'IncomeL9',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => Math.round(sr.federalAGI + sr.stateAdditions).toString(),
  },

  // Line 10: Subtractions
  {
    pdfFieldName: 'IncomeL10',
    sourcePath: 'stateSubtractions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 11: Idaho AGI
  {
    pdfFieldName: 'IncomeL11',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // TAX COMPUTATION (Lines 13–20)
  // ═══════════════════════════════════════════════════════════════

  // Line 13: Standard deduction
  {
    pdfFieldName: 'TxCompL13',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 15: Taxable income
  {
    pdfFieldName: 'TxCompL15',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 17: Idaho income tax
  {
    pdfFieldName: 'TxCompL17',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 19: Permanent building fund tax
  {
    pdfFieldName: 'IncomeL19',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Not modeled
  },

  // Line 20: Total tax
  {
    pdfFieldName: 'TxCompL20',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // CREDITS (Lines 21–26)
  // ═══════════════════════════════════════════════════════════════

  // Line 21: Total credits
  {
    pdfFieldName: 'CreditsL21',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const credits = sr.stateCredits;
      return credits > 0 ? Math.round(credits).toString() : '';
    },
  },

  // Line 25: Tax after credits
  {
    pdfFieldName: 'CreditsL25',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // OTHER TAXES (Lines 27–32)
  // ═══════════════════════════════════════════════════════════════

  // Line 32: Total tax
  {
    pdfFieldName: 'OtherTaxesL32',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS (Lines 44–50)
  // ═══════════════════════════════════════════════════════════════

  // Line 44: Idaho tax withheld
  {
    pdfFieldName: 'PymntOtherCreditL44',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 46: Estimated tax payments
  {
    pdfFieldName: 'PymntOtherCreditL46',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 47: Grocery credit
  {
    pdfFieldName: 'PymntOtherCreditL47',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const gc = sr.additionalLines?.groceryCredit || 0;
      return gc > 0 ? Math.round(gc).toString() : '';
    },
  },

  // Line 50: Total payments
  {
    pdfFieldName: 'PymntOtherCreditL50 Total 3',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      // stateCredits are non-refundable (already subtracted on Line 25).
      // Include the refundable grocery credit (Line 47) instead.
      const total = sr.stateWithholding + sr.stateEstimatedPayments + (sr.additionalLines?.groceryCredit || 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // REFUND / AMOUNT DUE (Lines 51–56)
  // ═══════════════════════════════════════════════════════════════

  // Line 51: Tax due
  {
    pdfFieldName: 'TxDueRefundL51',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 54: Overpayment
  {
    pdfFieldName: 'TxDueRefundL54',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 55: Amount due
  {
    pdfFieldName: 'TxDueRefundL55',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 56: Refund
  {
    pdfFieldName: 'RefundedL56-1',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const ID_40_TEMPLATE: StateFormTemplate = {
  formId: 'id-40',
  stateCode: 'ID',
  displayName: 'Form 40 Idaho Individual Income Tax Return',
  pdfFileName: 'id-40.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'ID',
  fields: ID_40_FIELDS,
};
