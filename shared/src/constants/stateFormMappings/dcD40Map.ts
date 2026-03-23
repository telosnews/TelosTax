/**
 * DC D-40 District of Columbia Individual Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 DC D-40 fillable PDF.
 *
 * DC is a custom calculator state with progressive tax brackets (4% – 10.75%).
 * Starts from federal AGI, applies DC-specific additions/subtractions,
 * then DC standard or itemized deduction.
 *
 * PDF: client/public/state-forms/dc-d40.pdf (62 fields, 3 pages)
 */
import type { TaxReturn, CalculationResult, StateCalculationResult } from '../../types/index.js';
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const DC_D40_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // PAGE 1 — Personal Information
  // ═══════════════════════════════════════════════════════════════

  // Primary filer TIN
  {
    pdfFieldName: 'Your TIN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Spouse TIN
  {
    pdfFieldName: 'Spouse TIN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // Primary filer name
  {
    pdfFieldName: 'Your First Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Your MI',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Your Last Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
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
    pdfFieldName: 'Spouse MI',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseMiddleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Spouse Last Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || '').toUpperCase(),
  },

  // Address
  {
    pdfFieldName: 'Home Address',
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
  {
    pdfFieldName: 'Email',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '', // Email not modeled in TaxReturn
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 1 — Income Lines (a–d, Line 4)
  // ═══════════════════════════════════════════════════════════════

  // Line a: Wages, salaries, tips (informational breakdown — not directly in SR)
  {
    pdfFieldName: 'Line a',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Wage breakdown not stored separately in StateCalculationResult
  },

  // Line b: Business income
  {
    pdfFieldName: 'Line b',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Business income breakdown not stored separately
  },

  // Line c: Capital gains
  {
    pdfFieldName: 'Line c',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Capital gains breakdown not stored separately
  },

  // Line d: Rental income
  {
    pdfFieldName: 'Line d',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Rental income breakdown not stored separately
  },

  // Line 4: Federal Adjusted Gross Income
  {
    pdfFieldName: 'Line 4',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 2 — Header
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: 'Page 2 Last Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Page 2 TIN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 2 — Additions to DC Income (Lines 5–7)
  // ═══════════════════════════════════════════════════════════════

  // Line 5: Addition to DC income
  {
    pdfFieldName: 'Line 5',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Individual addition lines not broken out in SR
  },

  // Line 6: Addition to DC income
  {
    pdfFieldName: 'Line 6',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Individual addition lines not broken out in SR
  },

  // Line 7: Total additions (mapped to stateAdditions)
  {
    pdfFieldName: 'Line 7',
    sourcePath: 'stateAdditions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 2 — Subtractions from DC Income (Lines 8–16)
  // ═══════════════════════════════════════════════════════════════

  // Lines 8–15: Individual subtraction lines — not broken out in SR
  {
    pdfFieldName: 'Line 8',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Individual subtraction lines not broken out
  },
  {
    pdfFieldName: 'Line 9',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Individual subtraction lines not broken out
  },
  {
    pdfFieldName: 'Line 10',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Individual subtraction lines not broken out
  },
  {
    pdfFieldName: 'Line 11',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Individual subtraction lines not broken out
  },
  {
    pdfFieldName: 'Line 12',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Individual subtraction lines not broken out
  },
  {
    pdfFieldName: 'Line 13',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Individual subtraction lines not broken out
  },
  {
    pdfFieldName: 'Line 14',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Individual subtraction lines not broken out
  },
  {
    pdfFieldName: 'Line 15',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Total subtractions — use Line 16 (DC AGI) instead
  },

  // Line 16: DC Adjusted Gross Income
  {
    pdfFieldName: 'Line 16',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 2 — Deductions, Taxable Income, Tax (Lines 18–26)
  // ═══════════════════════════════════════════════════════════════

  // Line 18: DC Deduction (standard or itemized)
  {
    pdfFieldName: 'Line 18',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 19: DC Taxable Income
  {
    pdfFieldName: 'Line 19',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 20: Tax (from DC tax rate schedule)
  {
    pdfFieldName: 'Line 20',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Lines 21–23: Credits
  {
    pdfFieldName: 'Line 21',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Individual credit lines not broken out in SR
  },
  {
    pdfFieldName: 'Line 22',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Individual credit lines not broken out in SR
  },
  {
    pdfFieldName: 'Line 23',
    sourcePath: 'stateCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 24: Tax after credits
  {
    pdfFieldName: 'Line 24',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 25: DC health care shared responsibility (not modeled)
  {
    pdfFieldName: 'Line 25',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // DC health care shared responsibility — not implemented
  },

  // Line 26: Total tax
  {
    pdfFieldName: 'Line 26',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 2 — DC EITC & Property Tax Credit (Lines 27–28)
  // ═══════════════════════════════════════════════════════════════

  // Lines 27b, 27d, 27e: DC EITC components — leave empty for now
  {
    pdfFieldName: 'Line 27b',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // DC EITC — not implemented yet
  },
  {
    pdfFieldName: 'Line 27d',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // DC EITC — not implemented yet
  },
  {
    pdfFieldName: 'Line 27e',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // DC EITC — not implemented yet
  },

  // Line 28: Property tax credit (not modeled)
  {
    pdfFieldName: 'Line 28',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Property tax credit — not implemented
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 3 — Header
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: 'Page 3 Last Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Page 3 TIN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 3 — Refundable Credits (Lines 29–30)
  // ═══════════════════════════════════════════════════════════════

  // Line 29: Refundable credits (not modeled)
  {
    pdfFieldName: 'Line 29',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Refundable credits — not implemented
  },

  // Line 30: Total refundable credits (not modeled)
  {
    pdfFieldName: 'Line 30',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Total refundable credits — not implemented
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 3 — Payments (Lines 31–36)
  // ═══════════════════════════════════════════════════════════════

  // Line 31: DC income tax withheld
  {
    pdfFieldName: 'Line 31',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 32: Estimated payments
  {
    pdfFieldName: 'Line 32',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Lines 33–35: Extension payment, amended return, other — not modeled
  {
    pdfFieldName: 'Line 33',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Extension payment — not implemented
  },
  {
    pdfFieldName: 'Line 34',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Amended return — not implemented
  },
  {
    pdfFieldName: 'Line 35',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Other — not implemented
  },

  // Line 36: Total payments and credits
  {
    pdfFieldName: 'Line 36',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      const total = sr.stateWithholding + sr.stateEstimatedPayments;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 3 — Balance Due / Refund (Lines 37–43)
  // ═══════════════════════════════════════════════════════════════

  // Line 37: Tax due (if total tax > total payments)
  {
    pdfFieldName: 'Line 37',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 38: Amount overpaid (if total payments > total tax)
  {
    pdfFieldName: 'Line 38',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Lines 39–41: Applied to next year, interest, contributions — not modeled
  {
    pdfFieldName: 'Line 39',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Applied to next year — not implemented
  },
  {
    pdfFieldName: 'Line 40',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Interest — not implemented
  },
  {
    pdfFieldName: 'Line 41',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Contributions — not implemented
  },

  // Line 42: Total amount due (same logic as Line 37)
  {
    pdfFieldName: 'Line 42',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 43: Net refund (same logic as Line 38)
  {
    pdfFieldName: 'Line 43',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const DC_D40_TEMPLATE: StateFormTemplate = {
  formId: 'dc-d40',
  stateCode: 'DC',
  displayName: 'D-40 District of Columbia Individual Income Tax Return',
  pdfFileName: 'dc-d40.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'DC',
  fields: DC_D40_FIELDS,
};
