/**
 * DE PIT-RES — Delaware Resident Personal Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 DE PIT-RES fillable PDF.
 *
 * DE is a progressive-tax state: 7 brackets (0% to 6.6%).
 * Standard deduction: $3,250 single / $6,500 MFJ.
 * Personal exemption credit: $110 per exemption.
 * DE EITC: taxpayer picks better of 4.5% refundable or 20% non-refundable.
 *
 * PDF: client/public/state-forms/de-pit-res.pdf (183 fields)
 * Enumerated via: npx tsx scripts/enumerate-pdf-fields.ts client/public/state-forms/de-pit-res.pdf
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const DE_PIT_RES_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: 'firstName',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'middleInitial',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'lastName',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'taxPayerID',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Spouse
  {
    pdfFieldName: 'spouseFirstName',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'spouseMiddleInitial',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseMiddleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'spouseLastName',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'spouseTaxpayerID',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // Address
  {
    pdfFieldName: 'homeAddress',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  {
    pdfFieldName: 'city',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressCity || '').toUpperCase(),
  },
  {
    pdfFieldName: 'state',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressState || '').toUpperCase(),
  },
  {
    pdfFieldName: 'zip',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.addressZip || '',
  },

  // Header combined name/ID fields (top of form)
  {
    pdfFieldName: 'tpName',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.firstName, tr.lastName].filter(Boolean);
      if (tr.spouseFirstName) {
        parts.push('&', tr.spouseFirstName, tr.spouseLastName || tr.lastName || '');
      }
      return parts.join(' ').toUpperCase();
    },
  },
  {
    pdfFieldName: 'tpID',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // ═══════════════════════════════════════════════════════════════
  // INCOME LINES (Column A — taxpayer)
  // ═══════════════════════════════════════════════════════════════

  // Line 1: Wages, salaries, tips
  {
    pdfFieldName: 'ln01ColA',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.w2Income || []).reduce((sum, w) => sum + (w.wages || 0), 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 3: Interest income
  {
    pdfFieldName: 'ln03ColA',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.income1099INT || []).reduce((sum, i) => sum + (i.amount || 0), 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 4: Dividend income
  {
    pdfFieldName: 'ln04ColA',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.income1099DIV || []).reduce(
        (sum, d) => sum + (d.ordinaryDividends || 0), 0,
      );
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 9: Federal AGI
  {
    pdfFieldName: 'ln09ColA',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // MODIFICATIONS & DEDUCTIONS (Lines 10–26)
  // ═══════════════════════════════════════════════════════════════

  // Line 11: Subtractions
  {
    pdfFieldName: 'ln11ColA',
    sourcePath: 'stateSubtractions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 14: DE Adjusted Gross Income
  {
    pdfFieldName: 'ln14ColA',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 20: Standard deduction
  {
    pdfFieldName: 'ln20ColA',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 23: Taxable income before exemptions
  {
    pdfFieldName: 'ln23ColA',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const val = Math.max(0, sr.stateAGI - sr.stateDeduction);
      return val > 0 ? Math.round(val).toString() : '';
    },
  },

  // Line 25: Tax before credits (from tax rate schedule)
  {
    pdfFieldName: 'ln25ColA',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 26: Tax (same as line 25 for most returns)
  {
    pdfFieldName: 'ln26ColA',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // EXEMPTIONS (Line 27)
  // ═══════════════════════════════════════════════════════════════

  // Line 27a: Number of exemptions
  {
    pdfFieldName: 'ln27aNoOfExemptions',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      let count = 1;
      if (tr.filingStatus === 2) count = 2; // MFJ
      count += (tr.dependents || []).length;
      return count.toString();
    },
  },

  // Line 27a: Exemption credit amount ($110 per exemption)
  {
    pdfFieldName: 'ln27aColA',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      // Credits include both exemption credit and EITC; the exemption credit
      // can be estimated but we use the total credits from the calculator
      const credits = sr.stateCredits;
      return credits > 0 ? Math.round(credits).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // TAX AFTER CREDITS & TOTALS (Lines 30–40)
  // ═══════════════════════════════════════════════════════════════

  // Line 30: Tax after credits
  {
    pdfFieldName: 'ln30ColA',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 33: Total tax
  {
    pdfFieldName: 'ln33ColA',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS (Lines 34–40)
  // ═══════════════════════════════════════════════════════════════

  // Line 34: DE tax withheld
  {
    pdfFieldName: 'ln34ColA',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 35: Estimated payments
  {
    pdfFieldName: 'ln35ColA',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 40: Total payments and credits
  {
    pdfFieldName: 'ln40ColA',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const total = sr.stateWithholding + sr.stateEstimatedPayments;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // REFUND / AMOUNT OWED (Lines 41–47)
  // ═══════════════════════════════════════════════════════════════

  // Line 41: Overpayment
  {
    pdfFieldName: 'ln41ColA',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 43: Refund (column B — combined)
  {
    pdfFieldName: 'ln43ColB',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 46: Tax due (column B)
  {
    pdfFieldName: 'ln46ColB',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 47: Total amount due (column B)
  {
    pdfFieldName: 'ln47ColB',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const DE_PIT_RES_TEMPLATE: StateFormTemplate = {
  formId: 'de-pit-res',
  stateCode: 'DE',
  displayName: 'DE PIT-RES Delaware Resident Personal Income Tax Return',
  pdfFileName: 'de-pit-res.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'DE',
  fields: DE_PIT_RES_FIELDS,
};
