/**
 * NJ-1040 New Jersey Resident Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 NJ-1040 fillable PDF.
 *
 * NJ-1040 has 814 AcroForm fields. We map the core identity, income, and tax lines.
 * Many NJ fields use descriptive names for page 1 and generic "Text##" or line numbers for pages 2+.
 */
import type { TaxReturn, CalculationResult, StateCalculationResult } from '../../types/index.js';
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const NJ_1040_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  // SSN
  {
    pdfFieldName: 'Your Social Security Number required',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },
  // Name (Last, First, MI for both filers)
  {
    pdfFieldName: 'Last Name First Name Initial Joint Filers enter first name and middle initial of each Enter spousesCU partners last name ONLY if different',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.lastName, tr.firstName, tr.middleInitial].filter(Boolean);
      if (tr.spouseFirstName) {
        parts.push('&', tr.spouseFirstName, tr.spouseMiddleInitial || '');
        if (tr.spouseLastName && tr.spouseLastName !== tr.lastName) {
          parts.push(tr.spouseLastName);
        }
      }
      return parts.join(' ').toUpperCase();
    },
  },
  // Spouse SSN
  {
    pdfFieldName: 'SpousesCU Partners SSN if filing jointly',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },
  // State
  {
    pdfFieldName: 'State',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressState || '').toUpperCase(),
  },
  // ZIP Code
  {
    pdfFieldName: 'ZIP Code',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.addressZip || '',
  },

  // Page 2 header: SSN
  {
    pdfFieldName: 'Your Social Security Number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },
  // Page 2 header: Names
  {
    pdfFieldName: 'Names as shown on Form NJ1040',
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

  // ═══════════════════════════════════════════════════════════════
  // INCOME LINES (Page 2)
  // ═══════════════════════════════════════════════════════════════

  // Line 15: Wages, salaries, tips
  {
    pdfFieldName: '15',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.w2Income || []).reduce((sum, w) => sum + (w.wages || 0), 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 16a: Taxable interest
  {
    pdfFieldName: '16a',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.income1099INT || []).reduce((sum, i) => sum + (i.amount || 0), 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 16b: Tax-exempt interest
  {
    pdfFieldName: '16b',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Not modeled
  },

  // Line 27: NJ gross income
  {
    pdfFieldName: '27',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // EXEMPTIONS & DEDUCTIONS (Page 1)
  // ═══════════════════════════════════════════════════════════════

  // Line 29: Total exemption amount
  {
    pdfFieldName: 'Text29',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const exemptions = sr.additionalLines?.personalExemptions || sr.stateExemptions || 0;
      return exemptions > 0 ? Math.round(exemptions).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // TAX COMPUTATION
  // ═══════════════════════════════════════════════════════════════

  // Line 36: Taxable income
  {
    pdfFieldName: 'Text36',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 37: Property tax deduction
  {
    pdfFieldName: 'Text37',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const propTaxDed = sr.additionalLines?.propertyTaxDeduction || 0;
      return propTaxDed > 0 ? Math.round(propTaxDed).toString() : '';
    },
  },

  // Line 38: NJ taxable income
  {
    pdfFieldName: 'Text38',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 39: Tax
  {
    pdfFieldName: 'Text39',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const tax = sr.additionalLines?.njTaxBeforeCredits || sr.stateIncomeTax || 0;
      return Math.round(tax).toString();
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS & BALANCE DUE
  // ═══════════════════════════════════════════════════════════════

  // Line 48: NJ income tax withheld
  {
    pdfFieldName: 'Text48',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 53: Total tax
  {
    pdfFieldName: 'Text53',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 54: Total payments
  {
    pdfFieldName: 'Text54',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const total = sr.stateWithholding + sr.stateEstimatedPayments;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 55: Balance due (if tax > payments)
  {
    pdfFieldName: 'Text55',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 56: Overpayment
  {
    pdfFieldName: 'Text56',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const NJ_1040_TEMPLATE: StateFormTemplate = {
  formId: 'nj-1040',
  stateCode: 'NJ',
  displayName: 'NJ-1040 New Jersey Resident Income Tax Return',
  pdfFileName: 'nj-1040.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'NJ',
  fields: NJ_1040_FIELDS,
};
