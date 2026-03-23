/**
 * IA 1040 Iowa Individual Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the 2025 IA 1040 fillable PDF.
 *
 * IA uses federal AGI as starting point. Flat 3.8% rate.
 * Federal standard deduction conformity. $40 per exemption credit.
 *
 * PDF: client/public/state-forms/ia-1040.pdf (236 fields)
 * Enumerated via: npx tsx scripts/enumerate-pdf-fields.ts client/public/state-forms/ia-1040.pdf
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const IA_1040_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: 'First Name',
    sourcePath: 'firstName',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Middle Initial',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Last Name',
    sourcePath: 'lastName',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Social Security Number (SSN)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Spouse
  {
    pdfFieldName: "Spouse's First Name",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  {
    pdfFieldName: "Spouse's Middle Initial",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseMiddleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: "Spouse's Last Name",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: "Spouse's Social Security Number (SSN)",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // Address
  {
    pdfFieldName: 'Current mailing address',
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
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.addressZip || '',
  },

  // Page 2 name (Taxpayers Name)
  {
    pdfFieldName: 'Taxpayers Name',
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
  // INCOME & TAX
  // ═══════════════════════════════════════════════════════════════

  // Line 2: Federal taxable income
  {
    pdfFieldName: '2 Federal taxable income',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 3: Net Iowa modifications from IA 1040 Schedule 1
  {
    pdfFieldName: '3 Net Iowa modifications from IA 1040 Schedule 1, line 22',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const net = sr.stateAdditions - sr.stateSubtractions;
      return net !== 0 ? Math.round(net).toString() : '';
    },
  },

  // Line 4: Iowa taxable income
  {
    pdfFieldName: '4 Iowa taxable income. Add lines 2 and 3',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 5: Iowa Tax
  {
    pdfFieldName: '5 Iowa Tax from tables or alternate tax',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 7: Total Tax
  {
    pdfFieldName: '7 Total Tax. Add lines 5 and 6',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 8: Total exemption credit amount
  {
    pdfFieldName: '8 Total exemption credit amount from Step 3',
    sourcePath: 'stateCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 11: Total Credits
  {
    pdfFieldName: '11 Total Credits. Add lines 8, 9, and 10',
    sourcePath: 'stateCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 12: Balance (tax minus credits)
  {
    pdfFieldName: '12 BALANCE. Subtract line 11 from line 7',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 20: Total state and local tax
  {
    pdfFieldName: '20 Total state and local tax. Add lines 18 and 19',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 22: Total (tax + contributions)
  {
    pdfFieldName: '22 Total contributions. Add lines 20 and 21',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS & REFUND
  // ═══════════════════════════════════════════════════════════════

  // Line 28: Iowa Tax Withheld
  {
    pdfFieldName: '28 Iowa income tax withheld',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 29: Estimated Tax Payments
  {
    pdfFieldName: '29 Estimated and voucher payments',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 30: Total payments
  {
    pdfFieldName: '30 TOTAL. Add lines 23 through 29',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const total = sr.stateWithholding + sr.stateEstimatedPayments;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 31a: Overpayment (if payments > tax)
  {
    pdfFieldName: '31a If line 30 is more than line 22, subtract line 22 from line 30',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 32: Refund
  {
    pdfFieldName: '32 Amount of line 31 to be REFUNDED',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 34: Tax Due
  {
    pdfFieldName: '34 If line 30 is less than line 22, subtract line 30 from line 22',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 37: Total amount due
  {
    pdfFieldName: '37 TOTAL AMOUNT DUE. ADD lines 34, 35 and 36',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const IA_1040_TEMPLATE: StateFormTemplate = {
  formId: 'ia-1040',
  stateCode: 'IA',
  displayName: 'IA 1040 Iowa Individual Income Tax Return',
  pdfFileName: 'ia-1040.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'IA',
  fields: IA_1040_FIELDS,
};
