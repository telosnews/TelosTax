/**
 * WV IT-140 West Virginia Personal Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 WV IT-140 fillable PDF.
 *
 * WV is a progressive-tax state: 5 brackets (2.22% – 4.82%).
 * Starts from federal AGI. No standard deduction. $2,000 personal/dependent
 * exemption. Same brackets for all filing statuses.
 *
 * PDF: client/public/state-forms/wv-it140.pdf (49 fields)
 */
import type { TaxReturn, CalculationResult, StateCalculationResult } from '../../types/index.js';
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';
import { FilingStatus } from '../../types/index.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const WV_IT140_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  // SSN (primary filer)
  {
    pdfFieldName: 'SSN',
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

  // Taxpayer name
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
  {
    pdfFieldName: 'Your First Name',
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

  // Spouse name
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
  {
    pdfFieldName: 'Spouse First Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Spouse MI',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseMiddleInitial || '').toUpperCase(),
  },

  // Address
  {
    pdfFieldName: 'Address Line 1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Address Line 2',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '', // Apt/suite line not modeled separately
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
  // EXEMPTIONS (boxes a–e)
  // a = yourself (1), b = spouse (1 if MFJ), c = dependents count,
  // e = total exemptions (a + b + c + d)
  // ═══════════════════════════════════════════════════════════════

  // Exemption a: Yourself
  {
    pdfFieldName: 'Exemption a',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '1',
  },

  // Exemption b: Spouse (1 if MFJ/QSS)
  {
    pdfFieldName: 'Exemption b',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      if (
        tr.filingStatus === FilingStatus.MarriedFilingJointly ||
        tr.filingStatus === FilingStatus.QualifyingSurvivingSpouse
      ) {
        return '1';
      }
      return '';
    },
  },

  // Exemption c: Dependents
  {
    pdfFieldName: 'Exemption c',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const count = (tr.dependents || []).length;
      return count > 0 ? count.toString() : '';
    },
  },

  // Exemption e: Total exemptions (a + b + c; box d not modeled)
  {
    pdfFieldName: 'Exemption e',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const isMFJ = tr.filingStatus === FilingStatus.MarriedFilingJointly ||
        tr.filingStatus === FilingStatus.QualifyingSurvivingSpouse;
      const numPersons = isMFJ ? 2 : 1;
      const total = numPersons + (tr.dependents || []).length;
      return total.toString();
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 1 — INCOME LINES (Lines 1–8)
  // ═══════════════════════════════════════════════════════════════

  // Line 1: Federal Adjusted Gross Income
  {
    pdfFieldName: 'Line 1',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 2: Additions to income (Schedule M line 61)
  {
    pdfFieldName: 'Line 2',
    sourcePath: 'stateAdditions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 3: Subtractions from income (Schedule M line 52)
  {
    pdfFieldName: 'Line 3',
    sourcePath: 'stateSubtractions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 4: WV Adjusted Gross Income (Line 1 + Line 2 - Line 3)
  {
    pdfFieldName: 'Line 4',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 5: Low-Income Earned Income Exclusion (not modeled)
  {
    pdfFieldName: 'Line 5',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Low-Income Earned Income Exclusion not implemented
  },

  // Line 6: Total Exemptions (box e x $2,000)
  {
    pdfFieldName: 'Line 6',
    sourcePath: 'stateExemptions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 7: WV Taxable Income (Line 4 - Lines 5 & 6)
  {
    pdfFieldName: 'Line 7',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 8: Income Tax Due (from tax rate schedule)
  {
    pdfFieldName: 'Line 8',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 2 HEADER
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: 'Page 2 Name',
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
    pdfFieldName: 'Page 2 SSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 2 — TAX & CREDITS (Lines 9–14)
  // ═══════════════════════════════════════════════════════════════

  // Line 9: Credits from Tax Credit Recap Schedule
  {
    pdfFieldName: 'Line 9',
    sourcePath: 'stateCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 10: Total Income Tax Due (Line 8 - Line 9)
  {
    pdfFieldName: 'Line 10',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Lines 11–13: Use tax, additions — not modeled
  {
    pdfFieldName: 'Line 11',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Consumer use tax — not implemented
  },
  {
    pdfFieldName: 'Line 12',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Addition to tax — not implemented
  },
  {
    pdfFieldName: 'Line 13',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Interest added to tax — not implemented
  },

  // Line 14: Total amount due (Lines 10–13)
  {
    pdfFieldName: 'Line 14',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 2 — PAYMENTS & CREDITS (Lines 15–23)
  // ═══════════════════════════════════════════════════════════════

  // Line 15: WV Income Tax Withheld
  {
    pdfFieldName: 'Line 15',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 16: Estimated Tax Payments
  {
    pdfFieldName: 'Line 16',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Lines 17–22: Extension payments, special credits — not modeled
  {
    pdfFieldName: 'Line 17',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Payment with extension — not implemented
  },
  {
    pdfFieldName: 'Line 18',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // WV/EDGE credit — not implemented
  },
  {
    pdfFieldName: 'Line 19',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Senior citizen tax credit — not implemented
  },
  {
    pdfFieldName: 'Line 20',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // WV Earned Income Tax Credit — not implemented
  },
  {
    pdfFieldName: 'Line 21',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Homestead Excess Property Tax Credit — not implemented
  },
  {
    pdfFieldName: 'Line 22',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // WV Health Sciences Service credit — not implemented
  },

  // Line 23: Payments and Refundable Credits (Lines 15–22)
  {
    pdfFieldName: 'Line 23',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      // stateCredits are non-refundable (already subtracted on Line 9).
      // Lines 17-22 (refundable credits) are not yet implemented.
      const total = sr.stateWithholding + sr.stateEstimatedPayments;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 2 — BALANCE DUE / REFUND (Lines 24–28)
  // ═══════════════════════════════════════════════════════════════

  // Line 24: Balance Due (Line 14 - Line 23, if positive)
  {
    pdfFieldName: 'Line 24',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 25: Total Overpayment (Line 23 - Line 14, if positive)
  {
    pdfFieldName: 'Line 25',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Lines 26–27: Overpayment applied to next year / penalties — not modeled
  {
    pdfFieldName: 'Line 26',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Amount applied to next year — not implemented
  },
  {
    pdfFieldName: 'Line 27',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Additions to tax / penalty — not implemented
  },

  // Line 28: Refund
  {
    pdfFieldName: 'Line 28',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const WV_IT140_TEMPLATE: StateFormTemplate = {
  formId: 'wv-it140',
  stateCode: 'WV',
  displayName: 'IT-140 West Virginia Personal Income Tax Return',
  pdfFileName: 'wv-it140.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'WV',
  fields: WV_IT140_FIELDS,
};
