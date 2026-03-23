/**
 * KS K-40 — Kansas Individual Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 K-40 fillable PDF.
 *
 * KS is a progressive-tax state: 5.2% / 5.58% brackets.
 * $9,160 personal exemption, $2,320 dependent exemption.
 * 17% refundable state EITC.
 *
 * PDF: client/public/state-forms/ks-k40.pdf (313 fields)
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const KS_K40_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: 'your first name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'your middle initial',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'your last name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'social security number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Spouse
  {
    pdfFieldName: 'spouses first name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'spouses middle initial',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseMiddleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'spouses last name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'your spouses social security number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // First four letters of last name
  {
    pdfFieldName: 'enter the first four letters of your last name - all CAPS',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').substring(0, 4).toUpperCase(),
  },
  {
    pdfFieldName: 'enter the first four letters of your spouses last name - all CAPS',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || tr.lastName || '').substring(0, 4).toUpperCase(),
  },

  // Address
  {
    pdfFieldName: 'mailing address',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  {
    pdfFieldName: 'city town or post office',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressCity || '').toUpperCase(),
  },
  {
    pdfFieldName: 'state - abbreviation',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressState || '').toUpperCase(),
  },
  {
    pdfFieldName: 'zip code - 5 digit',
    sourcePath: 'addressZip',
    source: 'taxReturn',
    format: 'string',
  },

  // ═══════════════════════════════════════════════════════════════
  // FILING STATUS
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: 'filing status - single',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 1,
  },
  {
    pdfFieldName: 'filing status - married filing joint',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 2,
  },
  {
    pdfFieldName: 'filing status - married filing separate',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 3,
  },
  {
    pdfFieldName: 'filing status - head of household',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 4,
  },

  // Residency
  {
    pdfFieldName: 'residency status - resident',
    sourcePath: 'residencyType',
    source: 'stateResult',
    format: 'checkbox',
    checkWhen: (_, _tr, _calc, sr) => sr.residencyType === 'resident',
  },

  // ═══════════════════════════════════════════════════════════════
  // EXEMPTIONS
  // ═══════════════════════════════════════════════════════════════

  // Exemption count and amount
  {
    pdfFieldName: 'total kansas exemptions',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      let count = 1; // Taxpayer
      if (tr.filingStatus === 2) count = 2; // MFJ: taxpayer + spouse
      count += (tr.dependents || []).length;
      return count.toString();
    },
  },
  {
    pdfFieldName: 'Total Kansas Exemption Amount. Add all amounts and enter result here',
    sourcePath: 'stateExemptions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Number of dependents
  {
    pdfFieldName: 'Dependents, enter the number of individuals you may claim as a dependent in the first box, multiply by $2,320 and enter total in the currency box to the right',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const count = (tr.dependents || []).length;
      return count > 0 ? count.toString() : '';
    },
  },
  {
    pdfFieldName: 'multiply number of dependents by $2,320 and enter total here',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const count = (tr.dependents || []).length;
      return count > 0 ? (count * 2320).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // INCOME & TAX (Lines 1–12)
  // ═══════════════════════════════════════════════════════════════

  // Line 1: Federal AGI
  {
    pdfFieldName: '1 federal adjusted gross income, as reported on your federal income tax return',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 2: Modifications (additions minus subtractions)
  {
    pdfFieldName: '2 modifications, from Sch S line a27, enclose sch s',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const mods = sr.stateAdditions - sr.stateSubtractions;
      return mods !== 0 ? Math.round(mods).toString() : '';
    },
  },

  // Line 3: Kansas AGI
  {
    pdfFieldName: '3 kansas adjusted gross income, line 2 added or subtracted from line 1',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 4: Standard/itemized deduction
  {
    pdfFieldName: '4 standard deduction or itemized deductions',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 5: Exemption allowance
  {
    pdfFieldName: '5 exemption allowance, x number of exemptions claimed',
    sourcePath: 'stateExemptions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 6: Total deductions
  {
    pdfFieldName: '6 total dudecutions, add lines 4 and 5',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => Math.round(sr.stateDeduction + sr.stateExemptions).toString(),
  },

  // Line 7: Taxable income
  {
    pdfFieldName: '7 taxable income, subtract line6 from line 3; if less than zero enter 0',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 8: Tax
  {
    pdfFieldName: '8 tax, use tax tables ot tax computation schedule',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 9: Nonresident percentage
  {
    pdfFieldName: '9 nonresident percentage, from sch s line b23 or if 100% enter 100.0000',
    sourcePath: '',
    source: 'stateResult',
    format: 'string',
    transform: () => '100.0000', // Resident returns default to 100%
  },

  // Line 12: Total income tax
  {
    pdfFieldName: '12 total income tax, residnets add lines 8 and 11; nonresidents enter amount form line 10',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // CREDITS (Lines 13–18)
  // ═══════════════════════════════════════════════════════════════

  // Line 16: Subtotal after credits
  {
    pdfFieldName: '16 subtotal, subtract lines 13, 14 and 15 from line 12',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 17: EITC
  {
    pdfFieldName: '17 earned income tax credit',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const eitc = sr.additionalLines?.stateEITC || 0;
      return eitc > 0 ? Math.round(eitc).toString() : '';
    },
  },

  // Line 18: Total tax balance
  {
    pdfFieldName: '18 total tax balance, subtract lines 17 from line 16; Cannot be less than zero',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS (Lines 19–27)
  // ═══════════════════════════════════════════════════════════════

  // Line 19: KS income tax withheld
  {
    pdfFieldName: '19 kansas income tax withheld from w2 and or 1099s',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 20: Estimated tax paid
  {
    pdfFieldName: '20 estimated tax paid',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 22: Refundable EITC
  {
    pdfFieldName: '22 refundable portion of earned income tax credit',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const eitc = sr.additionalLines?.stateEITC || 0;
      // KS EITC is refundable — the refundable portion is the excess over tax
      const excess = eitc - Math.max(0, sr.stateTaxAfterCredits);
      return excess > 0 ? Math.round(excess).toString() : '';
    },
  },

  // Line 27: Total refundable credits
  {
    pdfFieldName: '27 total refundable credits, add lines 19 - 25 and subtract line 26',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      // stateCredits are non-refundable (already subtracted on Line 16).
      // Include only the refundable EITC excess (Line 22) in the total.
      const eitcExcess = Math.max(0, (sr.additionalLines?.stateEITC || 0) - Math.max(0, sr.stateTaxAfterCredits));
      const total = sr.stateWithholding + sr.stateEstimatedPayments + eitcExcess;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // REFUND / AMOUNT OWED (Lines 28–43)
  // ═══════════════════════════════════════════════════════════════

  // Line 28: Underpayment (tax due)
  {
    pdfFieldName: '28 underpayment, if line 18 is greater than line 27 enter the difference here',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 32: Amount you owe
  {
    pdfFieldName: '32 amount you owe, add lines 28 - 31 and any entries on lines 35 - 42',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 33: Overpayment
  {
    pdfFieldName: '33 overpayment, if line 18 is less than 27 enter differnce here',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 43: Refund
  {
    pdfFieldName: '43 refund, subtract lines 34 - 42 from line 33',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const KS_K40_TEMPLATE: StateFormTemplate = {
  formId: 'ks-k40',
  stateCode: 'KS',
  displayName: 'K-40 Kansas Individual Income Tax Return',
  pdfFileName: 'ks-k40.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'KS',
  fields: KS_K40_FIELDS,
};
