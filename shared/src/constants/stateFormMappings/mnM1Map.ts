/**
 * MN Form M1 — Minnesota Individual Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 Form M1 fillable PDF.
 *
 * MN is a progressive-tax state: 4 brackets (5.35% to 9.85%).
 * Starts from federal taxable income. $5,200 dependent exemption.
 * 45% refundable state EITC.
 *
 * PDF: client/public/state-forms/mn-m1.pdf (81 fields)
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const MN_M1_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: 'yourfirstnameandinitial',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.firstName, tr.middleInitial].filter(Boolean);
      return parts.join(' ').toUpperCase();
    },
  },
  {
    pdfFieldName: 'LastName',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'YourSocialSecurityNumber',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },
  {
    pdfFieldName: 'YourDateofBirth',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.dateOfBirth || '',
  },

  // Spouse
  {
    pdfFieldName: 'SpousesFirstNameandInitial',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.spouseFirstName, tr.spouseMiddleInitial].filter(Boolean);
      return parts.join(' ').toUpperCase();
    },
  },
  {
    pdfFieldName: 'Spouseslastname',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      if (!tr.spouseLastName || tr.spouseLastName === tr.lastName) return '';
      return tr.spouseLastName.toUpperCase();
    },
  },
  {
    pdfFieldName: 'SpousesSocialSecurityNumber',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },
  {
    pdfFieldName: 'spousesdateofbirth',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.spouseDateOfBirth || '',
  },

  // Address
  {
    pdfFieldName: 'CurrentHomeAddress',
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
    pdfFieldName: 'zipcode',
    sourcePath: 'addressZip',
    source: 'taxReturn',
    format: 'string',
  },

  // ═══════════════════════════════════════════════════════════════
  // FILING STATUS (Checkboxes)
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: 'checkifsingle',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 1,
  },
  {
    pdfFieldName: 'checkifmarriedfilingjoint',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 2,
  },
  {
    pdfFieldName: 'checkifmarriedfilingseparately',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 3,
  },
  {
    pdfFieldName: 'checkifheadofhousehold',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 4,
  },
  {
    pdfFieldName: 'checkifqualifyingwidower',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 5,
  },

  // ═══════════════════════════════════════════════════════════════
  // INCOME (Lines 1–10)
  // ═══════════════════════════════════════════════════════════════

  // Line 1: Federal AGI
  {
    pdfFieldName: 'FAGI',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Wages, salaries, tips
  {
    pdfFieldName: 'wages, salaries, tips',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const w2Total = (tr.w2Income || []).reduce((s, w) => s + (w.wages || 0), 0);
      return w2Total > 0 ? Math.round(w2Total).toString() : '';
    },
  },

  // IRA, pensions, annuities
  {
    pdfFieldName: 'irapensionsannuities',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.income1099R || []).reduce((s, r) => s + (r.taxableAmount || 0), 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Social Security
  {
    pdfFieldName: 'SS benefits',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = tr.incomeSSA1099?.totalBenefits || 0;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Unemployment
  {
    pdfFieldName: 'unemployment',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.income1099G || []).reduce((s, g) => s + (g.unemploymentCompensation || 0), 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // M1 Line 1: Federal taxable income (MN starts from this)
  {
    pdfFieldName: 'm1line1',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => Math.round(calc.form1040.taxableIncome || 0).toString(),
  },

  // M1 Line 2: State additions
  {
    pdfFieldName: 'm1line2',
    sourcePath: 'stateAdditions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // M1 Line 3: Total (fed taxable + additions)
  {
    pdfFieldName: 'm1line3',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, calc, sr) => {
      return Math.round((calc.form1040.taxableIncome || 0) + sr.stateAdditions).toString();
    },
  },

  // M1 Line 4: Subtractions
  {
    pdfFieldName: 'm1line4',
    sourcePath: 'stateSubtractions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // M1 Line 5: MN taxable income
  {
    pdfFieldName: 'm1line5',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // M1 Line 6: MN tax from tables
  {
    pdfFieldName: 'm1line6',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // M1 Line 7: Dependent exemption
  {
    pdfFieldName: 'm1line7',
    sourcePath: 'stateExemptions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // M1 Line 8: Tax after dependent exemption
  {
    pdfFieldName: 'm1line8',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const tax = Math.max(0, sr.stateIncomeTax - sr.stateExemptions);
      return Math.round(tax).toString();
    },
  },

  // M1 Line 9: Nonrefundable credits
  {
    pdfFieldName: 'm1line9',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const credits = sr.stateCredits;
      return credits > 0 ? Math.round(credits).toString() : '';
    },
  },

  // M1 Line 10: Tax after credits
  {
    pdfFieldName: 'm1line10',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // ADDITIONS (Lines 11–14)
  // ═══════════════════════════════════════════════════════════════

  // M1 Line 11: Use tax
  {
    pdfFieldName: 'm1line11',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Not modeled
  },

  // M1 Line 12: Total additions
  {
    pdfFieldName: 'm1line12',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Not modeled
  },

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS (Lines 15–23)
  // ═══════════════════════════════════════════════════════════════

  // M1 Line 15: Total tax
  {
    pdfFieldName: 'm1line15',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // M1 Line 16: MN tax withheld
  {
    pdfFieldName: 'm1line16',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // M1 Line 17: Estimated tax payments
  {
    pdfFieldName: 'm1line17',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // M1 Line 18: MN EITC (45% of federal)
  {
    pdfFieldName: 'm1line18',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const eitc = sr.additionalLines?.stateEITC || 0;
      return eitc > 0 ? Math.round(eitc).toString() : '';
    },
  },

  // M1 Line 20: Total payments and credits
  {
    pdfFieldName: 'm1line20',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      // stateCredits are non-refundable (already subtracted on Line 9).
      // Include the refundable MN EITC (Line 18) instead.
      const total = sr.stateWithholding + sr.stateEstimatedPayments + (sr.additionalLines?.stateEITC || 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // REFUND / AMOUNT OWED (Lines 21–30)
  // ═══════════════════════════════════════════════════════════════

  // M1 Line 21: Overpayment
  {
    pdfFieldName: 'm1line21',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // M1 Line 22: Tax due
  {
    pdfFieldName: 'm1line22',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // M1 Line 27: Refund
  {
    pdfFieldName: 'm1line27',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // M1 Line 28: Amount owed
  {
    pdfFieldName: 'm1line28',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const MN_M1_TEMPLATE: StateFormTemplate = {
  formId: 'mn-m1',
  stateCode: 'MN',
  displayName: 'Form M1 Minnesota Individual Income Tax Return',
  pdfFileName: 'mn-m1.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'MN',
  fields: MN_M1_FIELDS,
};
