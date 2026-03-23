/**
 * NE Form 1040N — Nebraska Individual Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 Form 1040N fillable PDF.
 *
 * NE is a progressive-tax state: 4 brackets (2.46% to 5.2%).
 * Uses exemption credits ($171 per exemption) rather than deductions.
 * 10% refundable state EITC.
 *
 * PDF: client/public/state-forms/ne-1040n.pdf (388 fields)
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const NE_1040N_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: 'Your First Name and Middle Initial',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.firstName, tr.middleInitial].filter(Boolean);
      return parts.join(' ').toUpperCase();
    },
  },
  {
    pdfFieldName: 'Last Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },

  // Spouse
  {
    pdfFieldName: 'If a Joint Return Spouses First Name and Middle Initial',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.spouseFirstName, tr.spouseMiddleInitial].filter(Boolean);
      return parts.join(' ').toUpperCase();
    },
  },
  {
    pdfFieldName: 'Last Name_2',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      if (!tr.spouseLastName || tr.spouseLastName === tr.lastName) return '';
      return tr.spouseLastName.toUpperCase();
    },
  },

  // SSN (split across multiple fields)
  {
    pdfFieldName: 'Your Social Security Number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const ssn = (tr.ssn || tr.ssnLastFour || '').replace(/-/g, '');
      return ssn.substring(0, 3);
    },
  },
  {
    pdfFieldName: 'Your Social Security Number1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const ssn = (tr.ssn || tr.ssnLastFour || '').replace(/-/g, '');
      return ssn.substring(3, 5);
    },
  },
  {
    pdfFieldName: 'Your Social Security Number2',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const ssn = (tr.ssn || tr.ssnLastFour || '').replace(/-/g, '');
      return ssn.substring(5, 9);
    },
  },

  // Spouse SSN
  {
    pdfFieldName: 'Spouses Social Security Number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const ssn = (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, '');
      return ssn.substring(0, 3);
    },
  },
  {
    pdfFieldName: 'Spouses Social Security Number1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const ssn = (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, '');
      return ssn.substring(3, 5);
    },
  },
  {
    pdfFieldName: 'Spouses Social Security Number2',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const ssn = (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, '');
      return ssn.substring(5, 9);
    },
  },

  // Address
  {
    pdfFieldName: 'Current Mailing Address Number and Street or PO Box',
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
    pdfFieldName: 'ZIP Code',
    sourcePath: 'addressZip',
    source: 'taxReturn',
    format: 'string',
  },

  // Page 2 header: Name and SSN repeated
  {
    pdfFieldName: 'Full Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.firstName, tr.lastName].filter(Boolean);
      if (tr.spouseFirstName) parts.push('&', tr.spouseFirstName, tr.spouseLastName || tr.lastName || '');
      return parts.join(' ').toUpperCase();
    },
  },
  {
    pdfFieldName: "Spouse's SSN",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // ═══════════════════════════════════════════════════════════════
  // DEPENDENTS
  // ═══════════════════════════════════════════════════════════════

  // Line 4: Number of exemptions (including taxpayer + spouse + dependents)
  {
    pdfFieldName: '4',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      let count = 1; // Taxpayer
      if (tr.filingStatus === 2) count = 2; // MFJ: + spouse
      count += (tr.dependents || []).length;
      return count.toString();
    },
  },

  // Dependent names
  {
    pdfFieldName: 'Dependents First and Last Name 1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const dep = (tr.dependents || [])[0];
      return dep ? `${dep.firstName || ''} ${dep.lastName || ''}`.trim().toUpperCase() : '';
    },
  },
  {
    pdfFieldName: 'Dependents First and Last Name 2',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const dep = (tr.dependents || [])[1];
      return dep ? `${dep.firstName || ''} ${dep.lastName || ''}`.trim().toUpperCase() : '';
    },
  },
  {
    pdfFieldName: 'Dependents First and Last Name 3',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const dep = (tr.dependents || [])[2];
      return dep ? `${dep.firstName || ''} ${dep.lastName || ''}`.trim().toUpperCase() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // INCOME & TAX (Lines 5–15)
  // ═══════════════════════════════════════════════════════════════

  // Line 5: Federal AGI
  {
    pdfFieldName: '5',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 6: Nebraska additions
  {
    pdfFieldName: '6',
    sourcePath: 'stateAdditions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 7: Total (AGI + additions)
  {
    pdfFieldName: '7',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => Math.round(sr.federalAGI + sr.stateAdditions).toString(),
  },

  // Line 8: Nebraska subtractions
  {
    pdfFieldName: '8',
    sourcePath: 'stateSubtractions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 9: Nebraska AGI
  {
    pdfFieldName: '9',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 10: Standard/itemized deduction
  {
    pdfFieldName: '10',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 11: Taxable income
  {
    pdfFieldName: '11',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 12: Nebraska income tax
  {
    pdfFieldName: '12',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 13: Nebraska personal exemption credit ($171 x exemptions)
  {
    pdfFieldName: '13',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const credits = sr.stateCredits;
      return credits > 0 ? Math.round(credits).toString() : '';
    },
  },

  // Line 14: Tax after credits
  {
    pdfFieldName: '14',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 15: Total tax
  {
    pdfFieldName: '15',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS & CREDITS (Lines 29–44)
  // ═══════════════════════════════════════════════════════════════

  // Line 29: NE tax withheld
  {
    pdfFieldName: '29',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 30: Estimated tax payments
  {
    pdfFieldName: '30',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 31: NE EITC (10% of federal)
  {
    pdfFieldName: '31',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const eitc = sr.additionalLines?.stateEITC || 0;
      return eitc > 0 ? Math.round(eitc).toString() : '';
    },
  },

  // Line 38: Total payments
  {
    pdfFieldName: '38',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      // stateCredits are non-refundable (personal exemption credit, already subtracted on Line 13).
      // Include the refundable NE EITC (Line 31) instead.
      const total = sr.stateWithholding + sr.stateEstimatedPayments + (sr.additionalLines?.stateEITC || 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // REFUND / AMOUNT OWED (Lines 39–44)
  // ═══════════════════════════════════════════════════════════════

  // Line 39: Overpayment
  {
    pdfFieldName: '39',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 42: Refund
  {
    pdfFieldName: '42',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 43: Tax due
  {
    pdfFieldName: '43',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 44: Total amount due
  {
    pdfFieldName: '44',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const NE_1040N_TEMPLATE: StateFormTemplate = {
  formId: 'ne-1040n',
  stateCode: 'NE',
  displayName: 'Form 1040N Nebraska Individual Income Tax Return',
  pdfFileName: 'ne-1040n.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'NE',
  fields: NE_1040N_FIELDS,
};
