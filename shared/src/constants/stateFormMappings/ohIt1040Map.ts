/**
 * OH IT 1040 — Ohio Individual Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 OH IT 1040 fillable PDF.
 *
 * OH uses a custom calculator with 3 effective brackets (0%, 2.75%, 3.5%).
 * AGI-phased personal exemptions ($2,400 per person, phases out $40K–$80K).
 * No standard deduction. Social Security fully exempt.
 * Same brackets for all filing statuses.
 *
 * PDF: client/public/state-forms/oh-it1040.pdf (588 fields)
 * Enumerated via: npx tsx scripts/enumerate-pdf-fields.ts client/public/state-forms/oh-it1040.pdf
 *
 * additionalLines from OH calculator:
 *   - ohTaxBeforeCredits: tax before credits
 *   - personalExemptions: total exemption amount
 *   - perPersonExemption: per-person exemption (after phase-out)
 *   - exemptionCount: number of exemptions claimed
 *   - localTax: local/municipal tax (placeholder)
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const OH_IT1040_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: 'TP_SSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },
  {
    pdfFieldName: 'TP_FN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'TP_MI',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'TP_LN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },

  // Spouse
  {
    pdfFieldName: 'SP_SSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },
  {
    pdfFieldName: 'SP_FN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'SP_MI',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseMiddleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'SP_LN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || tr.lastName || '').toUpperCase(),
  },

  // Address
  {
    pdfFieldName: 'ADDRESS1',
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
    pdfFieldName: 'ZIP',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.addressZip || '',
  },

  // Payment voucher name fields (page 2)
  {
    pdfFieldName: 'OH40P_FN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'OH40P_LN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'OH40P_TP_SSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },
  {
    pdfFieldName: 'OH40P_ADDRESS',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  {
    pdfFieldName: 'OH40P_CITY_STATE_ZIP',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [
        (tr.addressCity || '').toUpperCase(),
        (tr.addressState || '').toUpperCase(),
        tr.addressZip || '',
      ].filter(Boolean);
      return parts.join(', ');
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // INCOME & TAX (Lines 1–6)
  // ═══════════════════════════════════════════════════════════════

  // Line 1: Federal AGI
  {
    pdfFieldName: 'L1',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 2a: Additions
  {
    pdfFieldName: 'L2A',
    sourcePath: 'stateAdditions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 2b: Subtractions (from Schedule A)
  {
    pdfFieldName: 'L2B',
    sourcePath: 'stateSubtractions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 3: Ohio AGI (Line 1 + 2a - 2b)
  {
    pdfFieldName: 'L3',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 4: Personal exemptions (phased)
  {
    pdfFieldName: 'L4',
    sourcePath: 'stateExemptions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 4 exemption count
  {
    pdfFieldName: 'L4_EXEMPT',
    sourcePath: '',
    source: 'stateResult',
    format: 'string',
    transform: (_tr, _calc, sr) => {
      const count = sr.additionalLines?.exemptionCount || 0;
      return count > 0 ? count.toString() : '';
    },
  },

  // Line 5: Ohio taxable income
  {
    pdfFieldName: 'L5',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 6: Tax (from bracket schedule)
  {
    pdfFieldName: 'L6',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const tax = sr.additionalLines?.ohTaxBeforeCredits || sr.stateIncomeTax || 0;
      return tax > 0 ? Math.round(tax).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // CREDITS & NET TAX (Lines 7–13)
  // ═══════════════════════════════════════════════════════════════

  // Line 8a: Ohio withholding
  {
    pdfFieldName: 'L8A',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 10: Total payments
  {
    pdfFieldName: 'L10',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const total = sr.stateWithholding + sr.stateEstimatedPayments;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 11: Tax after credits
  {
    pdfFieldName: 'L11',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 13: Total tax
  {
    pdfFieldName: 'L13',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // REFUND / AMOUNT OWED (Lines 14–17)
  // ═══════════════════════════════════════════════════════════════

  // Line 14: Overpayment (if payments exceed tax)
  {
    pdfFieldName: 'L14',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 15: Refund
  {
    pdfFieldName: 'L15',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 17: Amount you owe
  {
    pdfFieldName: 'L17',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Payment voucher amount
  {
    pdfFieldName: 'OH40P_PAY',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // SCHEDULE A — Income Adjustments (key lines)
  // ═══════════════════════════════════════════════════════════════

  // Schedule A Line 1: Wages from W-2
  {
    pdfFieldName: 'SchedA_L1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.w2Income || []).reduce((sum, w) => sum + (w.wages || 0), 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const OH_IT1040_TEMPLATE: StateFormTemplate = {
  formId: 'oh-it1040',
  stateCode: 'OH',
  displayName: 'OH IT 1040 Ohio Individual Income Tax Return',
  pdfFileName: 'oh-it1040.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'OH',
  fields: OH_IT1040_FIELDS,
};
