/**
 * NY IT-201 New York Resident Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 NY IT-201 fillable PDF.
 *
 * NY IT-201 AcroForm fields use descriptive names (e.g., "TP_first_name", "Line2").
 */
import type { TaxReturn, CalculationResult, StateCalculationResult } from '../../types/index.js';
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';
import { FilingStatus } from '../../types/index.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const NY_IT201_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  // Taxpayer SSN
  {
    pdfFieldName: 'TP_SSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },
  // Taxpayer first name
  {
    pdfFieldName: 'TP_first_name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  // Taxpayer middle initial
  {
    pdfFieldName: 'TP_MI',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  // Taxpayer last name
  {
    pdfFieldName: 'TP_last_name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  // Spouse first name
  {
    pdfFieldName: 'Spouse_first_name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  // Spouse middle initial
  {
    pdfFieldName: 'Spouse_MI',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseMiddleInitial || '').toUpperCase(),
  },
  // Spouse last name
  {
    pdfFieldName: 'Spouse_last_name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || '').toUpperCase(),
  },
  // Spouse SSN
  {
    pdfFieldName: 'Spouse_SSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // Mailing address
  {
    pdfFieldName: 'TP_mail_address',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  {
    pdfFieldName: 'TP_mail_city',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressCity || '').toUpperCase(),
  },
  {
    pdfFieldName: 'TP_mail_state',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressState || '').toUpperCase(),
  },
  {
    pdfFieldName: 'TP_mail_zip',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.addressZip || '',
  },
  // Occupation
  {
    pdfFieldName: 'TP_occupation',
    sourcePath: 'occupation',
    source: 'taxReturn',
    format: 'string',
  },
  {
    pdfFieldName: 'Spouse_occupation',
    sourcePath: 'spouseOccupation',
    source: 'taxReturn',
    format: 'string',
  },

  // Page 2 header: Name as shown on page 1
  {
    pdfFieldName: 'Name_as_page1',
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

  // Dependent 1 first name
  {
    pdfFieldName: 'H_first1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.dependents?.[0]?.firstName || '').toUpperCase(),
  },
  // Dependent 1 last name
  {
    pdfFieldName: 'H_last1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.dependents?.[0]?.lastName || '').toUpperCase(),
  },
  // Dependent 1 relationship
  {
    pdfFieldName: 'H_relationship1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.dependents?.[0]?.relationship || '',
  },

  // ═══════════════════════════════════════════════════════════════
  // INCOME LINES
  // ═══════════════════════════════════════════════════════════════

  // Line 1: Wages, salaries, tips
  {
    pdfFieldName: 'Line1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.w2Income || []).reduce((sum, w) => sum + (w.wages || 0), 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },
  // Line 2: Taxable interest income
  {
    pdfFieldName: 'Line2',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.income1099INT || []).reduce((sum, i) => sum + (i.amount || 0), 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },
  // Line 3: Ordinary dividends
  {
    pdfFieldName: 'Line3',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.income1099DIV || []).reduce((sum, d) => sum + (d.ordinaryDividends || 0), 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 17: Federal amount column - Federal AGI
  {
    pdfFieldName: 'Line17',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 19: NY subtractions
  {
    pdfFieldName: 'Line19',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateSubtractions > 0 ? Math.round(sr.stateSubtractions).toString() : '';
    },
  },

  // Line 22: NY additions
  {
    pdfFieldName: 'Line22',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateAdditions > 0 ? Math.round(sr.stateAdditions).toString() : '';
    },
  },

  // Line 33: NY AGI
  {
    pdfFieldName: 'Line33',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 34: NY itemized deduction (or standard deduction)
  {
    pdfFieldName: 'Line34',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 35: NY taxable income
  {
    pdfFieldName: 'Line35',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 36: Dependent exemption
  {
    pdfFieldName: 'Line36',
    sourcePath: 'stateExemptions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 37: NY taxable income (Line 35 - Line 36)
  {
    pdfFieldName: 'Line37',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return Math.round(Math.max(0, sr.stateTaxableIncome)).toString();
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // TAX, CREDITS & PAYMENTS (Page 3-4)
  // ═══════════════════════════════════════════════════════════════

  // Line 39: NY state tax on taxable income
  {
    pdfFieldName: 'Line39',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const nysTax = sr.additionalLines?.nysTaxBeforeCredits || sr.stateIncomeTax || 0;
      return Math.round(nysTax).toString();
    },
  },

  // Line 40: Household credit
  {
    pdfFieldName: 'Line40',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const credit = sr.additionalLines?.householdCredit || 0;
      return credit > 0 ? Math.round(credit).toString() : '';
    },
  },

  // Line 46: NYS tax after credits
  {
    pdfFieldName: 'Line46',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 47: NYC tax (from NYC resident schedule)
  {
    pdfFieldName: 'Line47',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const nycTax = sr.additionalLines?.nycTax || 0;
      return nycTax > 0 ? Math.round(nycTax).toString() : '';
    },
  },

  // Line 48: NYC household credit
  {
    pdfFieldName: 'Line48',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const credit = sr.additionalLines?.nycHouseholdCredit || 0;
      return credit > 0 ? Math.round(credit).toString() : '';
    },
  },

  // Line 51: Total NY state + NYC tax
  {
    pdfFieldName: 'Line51',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 54a: MCTMT net earnings from self-employment
  {
    pdfFieldName: 'Line54a',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const mctmt = sr.additionalLines?.mctmt || 0;
      return mctmt > 0 ? Math.round(sr.additionalLines?.mctmt || 0).toString() : '';
    },
  },

  // Line 54e: MCTMT amount
  {
    pdfFieldName: 'Line54e',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const mctmt = sr.additionalLines?.mctmt || 0;
      return mctmt > 0 ? Math.round(mctmt).toString() : '';
    },
  },

  // Line 55: Yonkers surcharge
  {
    pdfFieldName: 'Line55',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const yonkersTax = sr.additionalLines?.yonkersTax || 0;
      return yonkersTax > 0 ? Math.round(yonkersTax).toString() : '';
    },
  },

  // Line 63: Empire State Child Credit
  {
    pdfFieldName: 'Line63',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const credit = sr.additionalLines?.empireStateChildCredit || 0;
      return credit > 0 ? Math.round(credit).toString() : '';
    },
  },

  // Line 64: Child and dependent care credit
  {
    pdfFieldName: 'Line64',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const credit = sr.additionalLines?.nyDependentCareCredit || 0;
      return credit > 0 ? Math.round(credit).toString() : '';
    },
  },

  // Line 65: NY Earned Income Credit
  {
    pdfFieldName: 'Line65',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const nyEITC = sr.additionalLines?.nyEITC || 0;
      return nyEITC > 0 ? Math.round(nyEITC).toString() : '';
    },
  },

  // Line 68: College tuition credit
  {
    pdfFieldName: 'Line68',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const credit = sr.additionalLines?.collegeTuitionCredit || 0;
      return credit > 0 ? Math.round(credit).toString() : '';
    },
  },

  // Line 69: NYC school tax credit (fixed amount)
  {
    pdfFieldName: 'Line69',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const credit = sr.additionalLines?.nycSchoolTaxCreditFixed || 0;
      return credit > 0 ? Math.round(credit).toString() : '';
    },
  },

  // Line 69a: NYC school tax credit (rate reduction amount)
  {
    pdfFieldName: 'Line69a',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const credit = sr.additionalLines?.nycSchoolTaxCreditReduction || 0;
      return credit > 0 ? Math.round(credit).toString() : '';
    },
  },

  // Line 70: NYC EITC
  {
    pdfFieldName: 'Line70',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const credit = sr.additionalLines?.nycEITC || 0;
      return credit > 0 ? Math.round(credit).toString() : '';
    },
  },

  // Line 70a: NYC income tax elimination credit
  {
    pdfFieldName: 'Line70a',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const credit = sr.additionalLines?.nycTaxEliminationCredit || 0;
      return credit > 0 ? Math.round(credit).toString() : '';
    },
  },

  // Line 71: Total NY state tax withheld
  {
    pdfFieldName: 'Line71',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 75: Estimated tax payments
  {
    pdfFieldName: 'Line75',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateEstimatedPayments > 0 ? Math.round(sr.stateEstimatedPayments).toString() : '';
    },
  },

  // Line 76: Total payments and credits (withholding + estimated + all refundable credits)
  {
    pdfFieldName: 'Line76',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const totalRefundable = sr.additionalLines?.totalRefundable || 0;
      const total = sr.stateWithholding + sr.stateEstimatedPayments + totalRefundable;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 78: Overpayment
  {
    pdfFieldName: 'Line78',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 80: Amount owed
  {
    pdfFieldName: 'Line80',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 79: Refund
  {
    pdfFieldName: 'Line79',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const NY_IT201_TEMPLATE: StateFormTemplate = {
  formId: 'ny-it201',
  stateCode: 'NY',
  displayName: 'IT-201 New York Resident Income Tax Return',
  pdfFileName: 'ny-it201.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'NY',
  fields: NY_IT201_FIELDS,
};
