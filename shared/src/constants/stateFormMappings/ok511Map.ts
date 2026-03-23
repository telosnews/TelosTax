/**
 * OK Form 511 — Oklahoma Resident Individual Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 Form 511 fillable PDF.
 *
 * OK is a progressive-tax state: 6 brackets, top 4.75%.
 * $1,000 personal exemption per person, 5% refundable state EITC.
 *
 * PDF: client/public/state-forms/ok-511.pdf (294 fields)
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const OK_511_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: '511 Your First Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: '511 Your Middle Initial',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: '511 Your Last Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: '511 SSN1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Spouse
  {
    pdfFieldName: '511 sFirst Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  {
    pdfFieldName: '511 sMiddle Initial',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseMiddleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: '511 sLast Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: '511 sSSN1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // Address
  {
    pdfFieldName: '511 Address',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  {
    pdfFieldName: '511 City',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressCity || '').toUpperCase(),
  },
  {
    pdfFieldName: '511 State',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressState || '').toUpperCase(),
  },
  {
    pdfFieldName: '511 ZIP',
    sourcePath: 'addressZip',
    source: 'taxReturn',
    format: 'string',
  },

  // Occupation
  {
    pdfFieldName: '511 Taxpayer Occupation',
    sourcePath: 'occupation',
    source: 'taxReturn',
    format: 'string',
  },
  {
    pdfFieldName: '511 Spouse Occupation',
    sourcePath: 'spouseOccupation',
    source: 'taxReturn',
    format: 'string',
  },

  // ═══════════════════════════════════════════════════════════════
  // EXEMPTIONS
  // ═══════════════════════════════════════════════════════════════

  // Yourself
  {
    pdfFieldName: 'Exemptions 1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '1000', // $1,000 personal exemption
  },

  // Spouse (MFJ only)
  {
    pdfFieldName: 'Exemptions 2',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.filingStatus === 2 ? '1000' : '',
  },

  // Dependents
  {
    pdfFieldName: 'Exemptions 5',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const deps = (tr.dependents || []).length;
      return deps > 0 ? (deps * 1000).toString() : '';
    },
  },

  // Total exemptions
  {
    pdfFieldName: 'Exemptions 10',
    sourcePath: 'stateExemptions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PART 1 — INCOME (Lines 1–7)
  // ═══════════════════════════════════════════════════════════════

  // Line 1: Federal AGI
  {
    pdfFieldName: '511 Part 1 1',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 2: Oklahoma additions (Schedule 511-B)
  {
    pdfFieldName: '511 Part 1 2',
    sourcePath: 'stateAdditions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 3: Subtotal
  {
    pdfFieldName: '511 Part 1 3',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => Math.round(sr.federalAGI + sr.stateAdditions).toString(),
  },

  // Line 5: Oklahoma subtractions
  {
    pdfFieldName: '511 Part 1 5',
    sourcePath: 'stateSubtractions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 6: OK AGI
  {
    pdfFieldName: '511 Part 1 6',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 7: Deductions
  {
    pdfFieldName: '511 Part 1 7',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PART 2 — TAX COMPUTATION (Lines 8–19)
  // ═══════════════════════════════════════════════════════════════

  // Line 8: OK Taxable Income
  {
    pdfFieldName: '511 Part 2 8',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 9: Tax from schedule
  {
    pdfFieldName: '511 Part 2 9',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 15: Total tax after credits
  {
    pdfFieldName: '511 Part 2 15',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 16: EITC
  {
    pdfFieldName: '511 Part 2 16',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const eitc = sr.additionalLines?.stateEITC || 0;
      return eitc > 0 ? Math.round(eitc).toString() : '';
    },
  },

  // Line 17: Balance (tax after all credits)
  {
    pdfFieldName: '511 Part 2 17',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 19: Total tax
  {
    pdfFieldName: '511 Part 2 19',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PART 3 — PAYMENTS (Lines 20–33)
  // ═══════════════════════════════════════════════════════════════

  // Line 20: OK tax withheld
  {
    pdfFieldName: '511 Part 3 20',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 21: Estimated tax payments
  {
    pdfFieldName: '511 Part 3 21',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 33: Total payments/credits
  {
    pdfFieldName: '511 Part 3 33',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      // stateCredits are non-refundable (already subtracted on Line 15).
      // OK EITC is subtracted in the tax section (Lines 16-17), not in payments.
      const total = sr.stateWithholding + sr.stateEstimatedPayments;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // PART 4 — REFUND / AMOUNT OWED (Lines 34–38)
  // ═══════════════════════════════════════════════════════════════

  // Line 34: Overpayment
  {
    pdfFieldName: '511 Part 4 34',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 36: Refund
  {
    pdfFieldName: '511 Part 4 36',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 38: Tax due
  {
    pdfFieldName: '511 Part 4 38',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // PART 5 — AMOUNT DUE / CREDIT FORWARD
  // ═══════════════════════════════════════════════════════════════

  // Line 39: Payment amount due
  {
    pdfFieldName: '511 Part 5 39',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const OK_511_TEMPLATE: StateFormTemplate = {
  formId: 'ok-511',
  stateCode: 'OK',
  displayName: 'Form 511 Oklahoma Resident Individual Income Tax Return',
  pdfFileName: 'ok-511.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'OK',
  fields: OK_511_FIELDS,
};
