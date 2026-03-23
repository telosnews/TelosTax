/**
 * OR-40 Oregon Individual Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 OR-40 fillable PDF.
 *
 * OR is a progressive-tax state: 4 brackets (4.75% to 9.9%).
 * Starts from federal AGI. $256 exemption credit per person.
 * 12% refundable state EITC.
 *
 * PDF field names follow the pattern: or-40-p{page}-{field_number}
 *
 * PDF: client/public/state-forms/or-40.pdf (146 fields)
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const OR_40_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // PAGE 1 — Taxpayer Information & Filing Status
  // ═══════════════════════════════════════════════════════════════

  // p1-1: Tax year / form header (SSN area)
  {
    pdfFieldName: 'or-40-p1-1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Filing status checkboxes
  // p1-5: Single
  {
    pdfFieldName: 'or-40-p1-5',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 1,
  },
  // p1-6: Married filing jointly
  {
    pdfFieldName: 'or-40-p1-6',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 2,
  },
  // p1-7: Married filing separately
  {
    pdfFieldName: 'or-40-p1-7',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 3,
  },
  // p1-8: Head of household
  {
    pdfFieldName: 'or-40-p1-8',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 4,
  },
  // p1-9: Qualifying surviving spouse
  {
    pdfFieldName: 'or-40-p1-9',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 5,
  },

  // p1-11: First name and initial
  {
    pdfFieldName: 'or-40-p1-11',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.firstName, tr.middleInitial].filter(Boolean);
      return parts.join(' ').toUpperCase();
    },
  },
  // p1-12: Last name
  {
    pdfFieldName: 'or-40-p1-12',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  // p1-13: SSN
  {
    pdfFieldName: 'or-40-p1-13',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // p1-14: Spouse first name and initial
  {
    pdfFieldName: 'or-40-p1-14',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.spouseFirstName, tr.spouseMiddleInitial].filter(Boolean);
      return parts.join(' ').toUpperCase();
    },
  },
  // p1-15: Spouse last name
  {
    pdfFieldName: 'or-40-p1-15',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      if (!tr.spouseLastName || tr.spouseLastName === tr.lastName) return '';
      return tr.spouseLastName.toUpperCase();
    },
  },

  // p1-19: Current address
  {
    pdfFieldName: 'or-40-p1-19',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  // p1-20: City
  {
    pdfFieldName: 'or-40-p1-20',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressCity || '').toUpperCase(),
  },
  // p1-21: State
  {
    pdfFieldName: 'or-40-p1-21',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressState || '').toUpperCase(),
  },
  // p1-22: ZIP code
  {
    pdfFieldName: 'or-40-p1-22',
    sourcePath: 'addressZip',
    source: 'taxReturn',
    format: 'string',
  },

  // p1-27: Number of dependents
  {
    pdfFieldName: 'or-40-p1-27',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const count = (tr.dependents || []).length;
      return count > 0 ? count.toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 2 — Income
  // ═══════════════════════════════════════════════════════════════

  // p2-5: Wages (W-2 total)
  {
    pdfFieldName: 'or-40-p2-5',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.w2Income || []).reduce((s, w) => s + (w.wages || 0), 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // p2-11: Interest income
  {
    pdfFieldName: 'or-40-p2-11',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.income1099INT || []).reduce((s, i) => s + (i.amount || 0), 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // p2-12: Dividend income
  {
    pdfFieldName: 'or-40-p2-12',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.income1099DIV || []).reduce((s, d) => s + (d.ordinaryDividends || 0), 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // p2-18: Federal AGI
  {
    pdfFieldName: 'or-40-p2-18',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // p2-19: Additions (state additions)
  {
    pdfFieldName: 'or-40-p2-19',
    sourcePath: 'stateAdditions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // p2-20: Income after additions
  {
    pdfFieldName: 'or-40-p2-20',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => Math.round(sr.federalAGI + sr.stateAdditions).toString(),
  },

  // p2-21: Subtractions
  {
    pdfFieldName: 'or-40-p2-21',
    sourcePath: 'stateSubtractions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // p2-22: Oregon AGI
  {
    pdfFieldName: 'or-40-p2-22',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // p2-25: Oregon deductions (standard or itemized)
  {
    pdfFieldName: 'or-40-p2-25',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // p2-26: Oregon exemptions
  {
    pdfFieldName: 'or-40-p2-26',
    sourcePath: 'stateExemptions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // p2-27: Total deductions + exemptions
  {
    pdfFieldName: 'or-40-p2-27',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => Math.round(sr.stateDeduction + sr.stateExemptions).toString(),
  },

  // p2-28: Oregon taxable income
  {
    pdfFieldName: 'or-40-p2-28',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // p2-29: Oregon income tax
  {
    pdfFieldName: 'or-40-p2-29',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 3 — Credits & Tax
  // ═══════════════════════════════════════════════════════════════

  // p3-1: Standard credit / exemption credit
  {
    pdfFieldName: 'or-40-p3-1',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const credits = sr.stateCredits;
      return credits > 0 ? Math.round(credits).toString() : '';
    },
  },

  // p3-9: Total credits
  {
    pdfFieldName: 'or-40-p3-9',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const credits = sr.stateCredits;
      return credits > 0 ? Math.round(credits).toString() : '';
    },
  },

  // p3-10: Tax after credits
  {
    pdfFieldName: 'or-40-p3-10',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // p3-11: Total tax
  {
    pdfFieldName: 'or-40-p3-11',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 4 — Payments
  // ═══════════════════════════════════════════════════════════════

  // p4-4: Oregon tax withheld
  {
    pdfFieldName: 'or-40-p4-4',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // p4-5: Estimated tax payments
  {
    pdfFieldName: 'or-40-p4-5',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // p4-7: Oregon EITC
  {
    pdfFieldName: 'or-40-p4-7',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const eitc = sr.additionalLines?.stateEITC || 0;
      return eitc > 0 ? Math.round(eitc).toString() : '';
    },
  },

  // p4-10: Total payments and credits
  {
    pdfFieldName: 'or-40-p4-10',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      // stateCredits are non-refundable (exemption credit, already subtracted on p3-10).
      // Include the refundable OR EITC (p4-7) instead.
      const total = sr.stateWithholding + sr.stateEstimatedPayments + (sr.additionalLines?.stateEITC || 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 5 — Refund / Amount Due
  // ═══════════════════════════════════════════════════════════════

  // p5-1: Tax to pay (if owed)
  {
    pdfFieldName: 'or-40-p5-1',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // p5-5: Overpayment
  {
    pdfFieldName: 'or-40-p5-5',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // p5-12: Refund
  {
    pdfFieldName: 'or-40-p5-12',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // p5-14: Amount due
  {
    pdfFieldName: 'or-40-p5-14',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const OR_40_TEMPLATE: StateFormTemplate = {
  formId: 'or-40',
  stateCode: 'OR',
  displayName: 'OR-40 Oregon Individual Income Tax Return',
  pdfFileName: 'or-40.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'OR',
  fields: OR_40_FIELDS,
};
