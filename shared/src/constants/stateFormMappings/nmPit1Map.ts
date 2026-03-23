/**
 * NM PIT-1 New Mexico Personal Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 NM PIT-1 fillable PDF.
 *
 * NM is a progressive-tax state: 4 brackets (1.7% – 5.9%).
 * Starts from federal AGI. Applies federal standard/itemized deduction,
 * dependent deduction, and NM low/middle income exemption.
 *
 * PDF: client/public/state-forms/nm-pit1.pdf (42 fields)
 */
import type { TaxReturn, CalculationResult, StateCalculationResult } from '../../types/index.js';
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const NM_PIT1_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // PAGE 1 — IDENTITY
  // ═══════════════════════════════════════════════════════════════

  // Taxpayer Name 1a (first + MI + last)
  {
    pdfFieldName: 'Taxpayer Name 1a',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.firstName, tr.middleInitial, tr.lastName].filter(Boolean);
      return parts.join(' ').toUpperCase();
    },
  },

  // SSN 1b
  {
    pdfFieldName: 'SSN 1b',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Spouse Name 2a (first + MI + last)
  {
    pdfFieldName: 'Spouse Name 2a',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.spouseFirstName, tr.spouseMiddleInitial, tr.spouseLastName].filter(Boolean);
      return parts.length > 0 ? parts.join(' ').toUpperCase() : '';
    },
  },

  // SSN 2b (Spouse SSN)
  {
    pdfFieldName: 'SSN 2b',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // Mailing Address
  {
    pdfFieldName: 'Mailing Address 3b',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
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

  // ═══════════════════════════════════════════════════════════════
  // PAGE 1 — EXEMPTIONS
  // ═══════════════════════════════════════════════════════════════

  // Exemptions 5: total exemptions count
  {
    pdfFieldName: 'Exemptions 5',
    sourcePath: '',
    source: 'stateResult',
    format: 'string',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      // stateExemptions holds the dollar amount; display it as-is
      return sr.stateExemptions > 0 ? Math.round(sr.stateExemptions).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 1 — INCOME LINES 9–22
  // ═══════════════════════════════════════════════════════════════

  // Line 9: Federal Adjusted Gross Income
  {
    pdfFieldName: 'Line 9',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 10: State/local tax add-back (if itemized deductions used)
  {
    pdfFieldName: 'Line 10',
    sourcePath: 'stateAdditions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 11: Other additions to income
  {
    pdfFieldName: 'Line 11',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Additional additions — not separately modeled
  },

  // Line 12: Federal standard or itemized deduction
  {
    pdfFieldName: 'Line 12',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 13: Dependent deduction
  {
    pdfFieldName: 'Line 13',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      // stateSubtractions may include dependent deduction and exemption combined;
      // if a separate dependent deduction is not broken out, leave empty
      return '';
    },
  },

  // Line 14: NM low/middle income exemption
  {
    pdfFieldName: 'Line 14',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      // Low/middle income exemption — included in stateSubtractions but not broken out
      return '';
    },
  },

  // Line 15: Total deductions from federal income (Lines 12 + 13 + 14)
  {
    pdfFieldName: 'Line 15',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      const total = sr.stateDeduction + sr.stateSubtractions;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 17: NM Taxable Income
  {
    pdfFieldName: 'Line 17',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 18: NM Income Tax (from tax rate schedule)
  {
    pdfFieldName: 'Line 18',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 19: Lump-sum distribution tax — not modeled
  {
    pdfFieldName: 'Line 19',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 20: Credit for taxes paid to another state — not modeled
  {
    pdfFieldName: 'Line 20',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 21: Business-related income tax credits — not modeled
  {
    pdfFieldName: 'Line 21',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 22: Net NM Income Tax (Line 18 + 19 - 20 - 21)
  {
    pdfFieldName: 'Line 22',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 2 — HEADER
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: 'Page 2 SSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 2 — CREDITS & PAYMENTS (Lines 23–42)
  // ═══════════════════════════════════════════════════════════════

  // Line 23: Amount from Line 22
  {
    pdfFieldName: 'Line 23',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 24: Rebate/credit schedule — not modeled
  {
    pdfFieldName: 'Line 24',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 25: Working families tax credit — not modeled
  {
    pdfFieldName: 'Line 25',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 26: Refundable business credits — not modeled
  {
    pdfFieldName: 'Line 26',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 27: NM income tax withheld
  {
    pdfFieldName: 'Line 27',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 28: Oil and gas proceeds — not modeled
  {
    pdfFieldName: 'Line 28',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 29: Entity-level tax — not modeled
  {
    pdfFieldName: 'Line 29',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 30: Estimated payments — not modeled
  {
    pdfFieldName: 'Line 30',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 31: Other payments — not modeled
  {
    pdfFieldName: 'Line 31',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 32: Total payments and credits (Lines 27 + 28 + 29 + 30 + 31)
  {
    pdfFieldName: 'Line 32',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      const total = sr.stateWithholding + sr.stateEstimatedPayments;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 33: Tax due (if Line 23 > Line 32)
  {
    pdfFieldName: 'Line 33',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 34: Underpayment penalty — not modeled
  {
    pdfFieldName: 'Line 34',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 36: Penalty — not modeled
  {
    pdfFieldName: 'Line 36',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 37: Interest — not modeled
  {
    pdfFieldName: 'Line 37',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 38: Total tax, penalty, and interest due (Line 33 + 34 + 36 + 37)
  {
    pdfFieldName: 'Line 38',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      // Same as Line 33 since penalty/interest are not modeled
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 39: Overpayment (if Line 32 > Line 23)
  {
    pdfFieldName: 'Line 39',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 40: Refund contributions — not modeled
  {
    pdfFieldName: 'Line 40',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 41: Amount applied to next year — not modeled
  {
    pdfFieldName: 'Line 41',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 42: Amount to be refunded (Line 39 - 40 - 41)
  {
    pdfFieldName: 'Line 42',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      // Same as Line 39 since contributions/applied are not modeled
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const NM_PIT1_TEMPLATE: StateFormTemplate = {
  formId: 'nm-pit1',
  stateCode: 'NM',
  displayName: 'PIT-1 New Mexico Personal Income Tax Return',
  pdfFileName: 'nm-pit1.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'NM',
  fields: NM_PIT1_FIELDS,
};
