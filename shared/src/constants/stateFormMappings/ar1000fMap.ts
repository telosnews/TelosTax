/**
 * AR1000F Arkansas Individual Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 AR1000F fillable PDF.
 *
 * AR is a progressive-tax state: 5 brackets (0% to 3.9%).
 * Starts from federal AGI. $29 personal exemption credit.
 *
 * PDF field names follow the pattern: F_NR-{page}-{field_number}
 * Page 1 fields: F_NR-1-*, Page 2: F_NR0-2-*, Page 3: F_NR-3-*
 *
 * PDF: client/public/state-forms/ar-1000f.pdf (220 fields)
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const AR_1000F_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // PAGE 1 — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  // F_NR-1-1: Your first name
  {
    pdfFieldName: 'F_NR-1-1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.firstName, tr.middleInitial].filter(Boolean);
      return parts.join(' ').toUpperCase();
    },
  },
  // F_NR-1-2: Last name
  {
    pdfFieldName: 'F_NR-1-2',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  // F_NR-1-4: Your SSN
  {
    pdfFieldName: 'F_NR-1-4',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // F_NR-1-5: Spouse first name
  {
    pdfFieldName: 'F_NR-1-5',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.spouseFirstName, tr.spouseMiddleInitial].filter(Boolean);
      return parts.join(' ').toUpperCase();
    },
  },
  // F_NR-1-6: Spouse last name
  {
    pdfFieldName: 'F_NR-1-6',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      if (!tr.spouseLastName || tr.spouseLastName === tr.lastName) return '';
      return tr.spouseLastName.toUpperCase();
    },
  },
  // F_NR-1-8: Spouse SSN
  {
    pdfFieldName: 'F_NR-1-8',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // F_NR-1-9: Current mailing address
  {
    pdfFieldName: 'F_NR-1-9',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  // F_NR-1-10: City
  {
    pdfFieldName: 'F_NR-1-10',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressCity || '').toUpperCase(),
  },
  // F_NR-1-11: State
  {
    pdfFieldName: 'F_NR-1-11',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressState || '').toUpperCase(),
  },
  // F_NR-1-13: ZIP code
  {
    pdfFieldName: 'F_NR-1-13',
    sourcePath: 'addressZip',
    source: 'taxReturn',
    format: 'string',
  },

  // ═══════════════════════════════════════════════════════════════
  // FILING STATUS
  // ═══════════════════════════════════════════════════════════════

  // F_NR-1-37/38/39/40/41: Filing status checkboxes
  {
    pdfFieldName: 'F_NR-1-37',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 1, // Single
  },
  {
    pdfFieldName: 'F_NR-1-38',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 2, // MFJ
  },
  {
    pdfFieldName: 'F_NR-1-39',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 4, // HOH
  },
  {
    pdfFieldName: 'F_NR-1-40',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 3, // MFS
  },
  {
    pdfFieldName: 'F_NR-1-41',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 5, // QSS
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 1 — Income Lines
  // ═══════════════════════════════════════════════════════════════

  // F_NR-1-48: Wages
  {
    pdfFieldName: 'F_NR-1-48',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.w2Income || []).reduce((s, w) => s + (w.wages || 0), 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // F_NR-1-49: Interest income
  {
    pdfFieldName: 'F_NR-1-49',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.income1099INT || []).reduce((s, i) => s + (i.amount || 0), 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // F_NR-1-50: Dividend income
  {
    pdfFieldName: 'F_NR-1-50',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.income1099DIV || []).reduce((s, d) => s + (d.ordinaryDividends || 0), 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // F_NR-1-53: Business income
  {
    pdfFieldName: 'F_NR-1-53',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const biz = calc.scheduleC?.netProfit || 0;
      return biz !== 0 ? Math.round(biz).toString() : '';
    },
  },

  // F_NR-1-55: Capital gains
  {
    pdfFieldName: 'F_NR-1-55',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const gain = calc.scheduleD?.netGainOrLoss || 0;
      return gain !== 0 ? Math.round(gain).toString() : '';
    },
  },

  // F_NR-1-60: Federal AGI
  {
    pdfFieldName: 'F_NR-1-60',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // F_NR-1-62: Adjustments / Subtractions
  {
    pdfFieldName: 'F_NR-1-62',
    sourcePath: 'stateSubtractions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // F_NR-1-64: Arkansas AGI
  {
    pdfFieldName: 'F_NR-1-64',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 2 — Deductions, Tax Computation
  // ═══════════════════════════════════════════════════════════════

  // F_NR0-2-29: Standard deduction
  {
    pdfFieldName: 'F_NR0-2-29',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // F_NR0-2-33: Taxable income
  {
    pdfFieldName: 'F_NR0-2-33',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // F_NR0-2-34: Arkansas income tax
  {
    pdfFieldName: 'F_NR0-2-34',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // F_NR0-2-60: Tax credits
  {
    pdfFieldName: 'F_NR0-2-60',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const credits = sr.stateCredits;
      return credits > 0 ? Math.round(credits).toString() : '';
    },
  },

  // F_NR0-2-62: Tax after credits
  {
    pdfFieldName: 'F_NR0-2-62',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // F_NR0-2-74: Total tax
  {
    pdfFieldName: 'F_NR0-2-74',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 3 — Payments, Refund/Amount Due
  // ═══════════════════════════════════════════════════════════════

  // F_NR-3-1: Name (repeated)
  {
    pdfFieldName: 'F_NR-3-1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.firstName, tr.lastName].filter(Boolean);
      return parts.join(' ').toUpperCase();
    },
  },

  // F_NR-3-1B: SSN (repeated)
  {
    pdfFieldName: 'F_NR-3-1B',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // F_NR-3-2: AR tax withheld
  {
    pdfFieldName: 'F_NR-3-2',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // F_NR-3-3: Estimated tax payments
  {
    pdfFieldName: 'F_NR-3-3',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // F_NR-3-8: Total payments
  {
    pdfFieldName: 'F_NR-3-8',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const total = sr.stateWithholding + sr.stateEstimatedPayments;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // F_NR-3-10: Overpayment
  {
    pdfFieldName: 'F_NR-3-10',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // F_NR-3-14: Refund amount
  {
    pdfFieldName: 'F_NR-3-14',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // F_NR-3-16: Tax due
  {
    pdfFieldName: 'F_NR-3-16',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // F_NR-3-17: Amount due with return
  {
    pdfFieldName: 'F_NR-3-17',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const AR_1000F_TEMPLATE: StateFormTemplate = {
  formId: 'ar-1000f',
  stateCode: 'AR',
  displayName: 'AR1000F Arkansas Individual Income Tax Return',
  pdfFileName: 'ar-1000f.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'AR',
  fields: AR_1000F_FIELDS,
};
