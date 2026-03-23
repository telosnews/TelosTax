/**
 * Maine 1040ME — Maine Individual Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 Form 1040ME fillable PDF.
 *
 * ME is a progressive-tax state: 3 brackets (5.8% to 7.15%).
 * Starts from federal AGI. $4,700 personal exemption.
 * Dual EITC rates: 12% non-refundable + 25% refundable.
 *
 * PDF field names are descriptive (e.g., "Form 1040ME Your First Name").
 *
 * PDF: client/public/state-forms/me-1040.pdf (110 fields)
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const ME_1040_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: 'Form 1040ME Your First Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Form 1040ME Middle Initial',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Form 1040ME Last name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Form 1040ME Your social security number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Spouse
  {
    pdfFieldName: "Form 1040ME Spouse's first name",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Form 1040 S M I',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseMiddleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: "Form 1040ME Spouse's last name",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      if (!tr.spouseLastName || tr.spouseLastName === tr.lastName) return '';
      return tr.spouseLastName.toUpperCase();
    },
  },
  {
    pdfFieldName: "Form 1040ME Spouse's social security number",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // Address
  {
    pdfFieldName: 'Form 1040ME Current mailing address',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Form 1040ME City or town',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressCity || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Form 1040ME State',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressState || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Form 1040ME Zip code',
    sourcePath: 'addressZip',
    source: 'taxReturn',
    format: 'string',
  },

  // Occupation
  {
    pdfFieldName: '1040ME Your occupation',
    sourcePath: 'occupation',
    source: 'taxReturn',
    format: 'string',
  },
  {
    pdfFieldName: "1040ME Spouse's occupation",
    sourcePath: 'spouseOccupation',
    source: 'taxReturn',
    format: 'string',
  },

  // ═══════════════════════════════════════════════════════════════
  // FILING STATUS & RESIDENCY
  // ═══════════════════════════════════════════════════════════════

  // radStatus is a RadioGroup — handled with transform for the filing status value
  // The PDF uses radio values, so we map to the radio group directly

  // Exemptions
  {
    pdfFieldName: '1040ME Total number of exemptions',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const isMFJ = tr.filingStatus === 2 || tr.filingStatus === 5;
      const persons = isMFJ ? 2 : 1;
      const deps = (tr.dependents || []).length;
      return (persons + deps).toString();
    },
  },
  {
    pdfFieldName: '1040ME Total qualifying children and dependents',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const count = (tr.dependents || []).length;
      return count > 0 ? count.toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // INCOME & TAX COMPUTATION
  // ═══════════════════════════════════════════════════════════════

  // Federal adjusted gross income
  {
    pdfFieldName: '1040ME Federal adjusted gross income',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Additions
  {
    pdfFieldName: '1040ME Income modifications additions',
    sourcePath: 'stateAdditions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Subtractions
  {
    pdfFieldName: '1040ME Income modifications subtractions',
    sourcePath: 'stateSubtractions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Maine AGI
  {
    pdfFieldName: '1040ME Maine adjusted gross income',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Deduction
  {
    pdfFieldName: '1040ME Deduction',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Exemption
  {
    pdfFieldName: '1040ME Exemption',
    sourcePath: 'stateExemptions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Taxable income
  {
    pdfFieldName: '1040ME Taxable income',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Income tax
  {
    pdfFieldName: '1040ME Income tax',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Total tax
  {
    pdfFieldName: '1040ME Total tax',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Tax credits
  {
    pdfFieldName: '1040ME Tax credits',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const credits = sr.stateCredits;
      return credits > 0 ? Math.round(credits).toString() : '';
    },
  },

  // Net tax
  {
    pdfFieldName: '1040ME Net tax',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS
  // ═══════════════════════════════════════════════════════════════

  // Tax payments (withholding)
  {
    pdfFieldName: '1040ME Tax payments',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Estimated payments
  {
    pdfFieldName: '1040ME 2019 estimated payments and 2018 carry forwards, and real estate withholding payments',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Refundable tax credits (state EITC refundable portion)
  {
    pdfFieldName: '1040ME Refunable tax credit',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const refundable = sr.additionalLines?.refundableExcess || 0;
      return refundable > 0 ? Math.round(refundable).toString() : '';
    },
  },

  // Total payments
  {
    pdfFieldName: '1040ME Total',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const total = sr.stateWithholding + sr.stateEstimatedPayments + (sr.additionalLines?.refundableExcess || 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // REFUND / AMOUNT DUE
  // ═══════════════════════════════════════════════════════════════

  // Income tax overpaid
  {
    pdfFieldName: '1040ME Income tax overpaid',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Income tax underpaid
  {
    pdfFieldName: '1040ME Income tax underpaid',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Refund
  {
    pdfFieldName: '1040ME Refund',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Total amount due
  {
    pdfFieldName: 'Total amount due',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Name repeated on page 2
  {
    pdfFieldName: '1040ME First name last name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.firstName, tr.lastName].filter(Boolean);
      return parts.join(' ').toUpperCase();
    },
  },

  // SSN repeated on page 2
  {
    pdfFieldName: '1040ME Your social security number again',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },
];

// ─── Template ────────────────────────────────────────────────────

export const ME_1040_TEMPLATE: StateFormTemplate = {
  formId: 'me-1040',
  stateCode: 'ME',
  displayName: 'Form 1040ME Maine Individual Income Tax Return',
  pdfFileName: 'me-1040.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'ME',
  fields: ME_1040_FIELDS,
};
