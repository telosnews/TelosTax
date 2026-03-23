/**
 * CA-540NR California Nonresident or Part-Year Resident Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 CA Form 540NR fillable PDF.
 *
 * 540NR AcroForm fields use "540NR_form_XYYY" where X = page (1–6), YYY = field id.
 * The mapping below was derived by enumerating PDF fields and correlating with the form layout.
 *
 * Key differences from 540 (resident):
 *   - Applies only to part-year residents and nonresidents
 *   - Uses full-year income for bracket computation, then prorates by CA income ratio
 *   - Credits are prorated by the ratio of CA-source taxable income to total taxable income
 */
import type { TaxReturn, CalculationResult, StateCalculationResult } from '../../types/index.js';
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';
import { FilingStatus } from '../../types/index.js';

// ─── Helpers ──────────────────────────────────────────────────────

/** Get a value from additionalLines with a default of 0. */
function al(sr: StateCalculationResult, key: string): number {
  return (sr.additionalLines?.[key] as number) || 0;
}

/** Format a decimal ratio as "0.XXXX" (4 decimal places). */
function fmtRatio(n: number): string {
  if (n <= 0) return '0.0000';
  if (n >= 1) return '1.0000';
  return n.toFixed(4);
}

// ─── Field Mappings ──────────────────────────────────────────────

export const CA_540NR_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // PAGE 1 — Taxpayer Information, Filing Status, Exemptions
  // ═══════════════════════════════════════════════════════════════

  // Your first name
  {
    pdfFieldName: '540NR_form_1003',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  // Your initial
  {
    pdfFieldName: '540NR_form_1004',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  // Your last name
  {
    pdfFieldName: '540NR_form_1005',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  // Your SSN or ITIN
  {
    pdfFieldName: '540NR_form_1007',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },
  // Spouse's first name
  {
    pdfFieldName: '540NR_form_1008',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  // Spouse's last name
  {
    pdfFieldName: '540NR_form_1010',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || '').toUpperCase(),
  },
  // Spouse's SSN
  {
    pdfFieldName: '540NR_form_1012',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // Street address
  {
    pdfFieldName: '540NR_form_1015',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  // City
  {
    pdfFieldName: '540NR_form_1018',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressCity || '').toUpperCase(),
  },
  // State
  {
    pdfFieldName: '540NR_form_1019',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressState || '').toUpperCase(),
  },
  // ZIP code
  {
    pdfFieldName: '540NR_form_1020',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.addressZip || '',
  },

  // Filing Status radio group (1=Single, 2=MFJ, 3=MFS, 4=HoH, 5=QSS)
  {
    pdfFieldName: '540NR_form_1029 RB',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      switch (tr.filingStatus) {
        case FilingStatus.Single: return '1';
        case FilingStatus.MarriedFilingJointly: return '2';
        case FilingStatus.MarriedFilingSeparately: return '3';
        case FilingStatus.HeadOfHousehold: return '4';
        case FilingStatus.QualifyingSurvivingSpouse: return '5';
        default: return '1';
      }
    },
  },

  // Line 7: Personal exemption count
  {
    pdfFieldName: '540NR_form_1034',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const isMFJ = tr.filingStatus === FilingStatus.MarriedFilingJointly ||
        tr.filingStatus === FilingStatus.QualifyingSurvivingSpouse;
      return isMFJ ? '2' : '1';
    },
  },
  // Line 7 dollar amount (count × $153)
  {
    pdfFieldName: '540NR_form_1035',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const isMFJ = tr.filingStatus === FilingStatus.MarriedFilingJointly ||
        tr.filingStatus === FilingStatus.QualifyingSurvivingSpouse;
      return (isMFJ ? 306 : 153).toString();
    },
  },

  // Line 10: Dependents count
  {
    pdfFieldName: '540NR_form_1052',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const count = (tr.dependents || []).length;
      return count > 0 ? count.toString() : '';
    },
  },
  // Line 10: Dependents dollar amount (count × $475)
  {
    pdfFieldName: '540NR_form_1053',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const count = (tr.dependents || []).length;
      return count > 0 ? (count * 475).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 2 — Income, Tax Computation, Credits
  // ═══════════════════════════════════════════════════════════════

  // Page 2 header: Your name
  {
    pdfFieldName: '540NR_form_2001',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.firstName, tr.lastName].filter(Boolean);
      return parts.join(' ').toUpperCase();
    },
  },
  // Page 2 header: Your SSN
  {
    pdfFieldName: '540NR_form_2002',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Line 11: Exemption amount (total from lines 7-10)
  {
    pdfFieldName: '540NR_form_2003',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const credits = al(sr, 'personalExemptionCredits');
      return credits > 0 ? Math.round(credits).toString() : '';
    },
  },

  // Line 12: Total CA wages from W-2, box 16
  {
    pdfFieldName: '540NR_form_2004',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const wages = (tr.w2Income || []).reduce((sum, w) => sum + (w.stateWages || w.wages || 0), 0);
      return wages > 0 ? Math.round(wages).toString() : '';
    },
  },

  // Line 13: Federal AGI (from ALL sources — Column A)
  {
    pdfFieldName: '540NR_form_2005',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const originalAGI = al(sr, 'originalFederalAGI');
      return originalAGI > 0 ? Math.round(originalAGI).toString() : Math.round(sr.federalAGI).toString();
    },
  },

  // Line 14: CA adjustments — subtractions
  {
    pdfFieldName: '540NR_form_2006',
    sourcePath: 'stateSubtractions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 15: Line 13 − Line 14
  {
    pdfFieldName: '540NR_form_2007',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const originalAGI = al(sr, 'originalFederalAGI') || sr.federalAGI;
      const val = originalAGI - sr.stateSubtractions;
      return Math.round(Math.max(0, val)).toString();
    },
  },

  // Line 16: CA adjustments — additions
  {
    pdfFieldName: '540NR_form_2008',
    sourcePath: 'stateAdditions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 17: Adjusted gross income from all sources (full-year CA AGI)
  {
    pdfFieldName: '540NR_form_2009',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const fullYearCAGI = al(sr, 'fullYearCAGI');
      return Math.round(Math.max(0, fullYearCAGI)).toString();
    },
  },

  // Line 18: Deduction (standard or itemized, full-year)
  {
    pdfFieldName: '540NR_form_2010',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const fullYearDeduction = al(sr, 'fullYearDeduction');
      return Math.round(fullYearDeduction).toString();
    },
  },

  // Line 19: Total taxable income (full-year: Line 17 − Line 18)
  {
    pdfFieldName: '540NR_form_2011',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const fullYearTaxable = al(sr, 'fullYearTaxableIncome');
      return Math.round(Math.max(0, fullYearTaxable)).toString();
    },
  },

  // Line 31: Tax from brackets (on all income)
  {
    pdfFieldName: '540NR_form_2016',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const baseTax = al(sr, 'baseTaxBeforeMHST');
      return baseTax > 0 ? Math.round(baseTax).toString() : '';
    },
  },

  // Line 32: CA adjusted gross income from Schedule CA (540NR) — CA-source AGI
  {
    pdfFieldName: '540NR_form_2017',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return Math.round(Math.max(0, sr.stateAGI)).toString();
    },
  },

  // Line 35: CA Taxable Income from Schedule CA — CA-source taxable income
  {
    pdfFieldName: '540NR_form_2018',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 36: CA Tax Rate (Line 31 ÷ Line 19) — decimal format "0.XXXX"
  {
    pdfFieldName: '540NR_form_2020',
    sourcePath: '',
    source: 'stateResult',
    format: 'string',
    transform: (_tr, _calc, sr) => {
      const baseTax = al(sr, 'baseTaxBeforeMHST');
      const fullYearTaxable = al(sr, 'fullYearTaxableIncome');
      if (fullYearTaxable <= 0) return '0.0000';
      return fmtRatio(baseTax / fullYearTaxable);
    },
  },

  // Line 37: CA Tax Before Exemption Credits (Line 35 × Line 36)
  {
    pdfFieldName: '540NR_form_2021',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const proratedBaseTax = al(sr, 'proratedBaseTax');
      return proratedBaseTax > 0 ? Math.round(proratedBaseTax).toString() : '';
    },
  },

  // Line 38: CA Exemption Credit Percentage (Line 35 ÷ Line 19) — "0.XXXX"
  {
    pdfFieldName: '540NR_form_2023',
    sourcePath: '',
    source: 'stateResult',
    format: 'string',
    transform: (_tr, _calc, sr) => {
      const fullYearTaxable = al(sr, 'fullYearTaxableIncome');
      if (fullYearTaxable <= 0) return '0.0000';
      const ratio = sr.stateTaxableIncome / fullYearTaxable;
      return ratio > 1 ? '1.0000' : fmtRatio(ratio);
    },
  },

  // Line 39: CA Prorated Exemption Credits (Line 11 × Line 38)
  {
    pdfFieldName: '540NR_form_2024',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const credits = al(sr, 'proratedNonrefundableCredits');
      return credits > 0 ? Math.round(credits).toString() : '';
    },
  },

  // Line 40: CA Regular Tax Before Credits (Line 37 − Line 39)
  {
    pdfFieldName: '540NR_form_2025',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const proratedTax = al(sr, 'proratedBaseTax');
      const proratedCredits = al(sr, 'proratedNonrefundableCredits');
      return Math.round(Math.max(0, proratedTax - proratedCredits)).toString();
    },
  },

  // Line 42: Add line 40 and line 41 (same as line 40 for simple returns)
  {
    pdfFieldName: '540NR_form_2029',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const proratedTax = al(sr, 'proratedBaseTax');
      const proratedCredits = al(sr, 'proratedNonrefundableCredits');
      return Math.round(Math.max(0, proratedTax - proratedCredits)).toString();
    },
  },

  // Line 50: Nonrefundable Dependent Care Credit (prorated)
  {
    pdfFieldName: '540NR_form_2030',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const depCare = al(sr, 'caDependentCareCredit');
      return depCare > 0 ? Math.round(depCare).toString() : '';
    },
  },

  // Line 52: Dependent parent credit
  {
    pdfFieldName: '540NR_form_2032',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const depParent = al(sr, 'dependentParentCredit');
      return depParent > 0 ? Math.round(depParent).toString() : '';
    },
  },

  // Line 53: Senior Head of Household credit
  {
    pdfFieldName: '540NR_form_2033',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const seniorHoH = al(sr, 'seniorHoHCredit');
      return seniorHoH > 0 ? Math.round(seniorHoH).toString() : '';
    },
  },

  // Line 54: Credit percentage (same as Line 38 ratio)
  {
    pdfFieldName: '540NR_form_2035',
    sourcePath: '',
    source: 'stateResult',
    format: 'string',
    transform: (_tr, _calc, sr) => {
      const fullYearTaxable = al(sr, 'fullYearTaxableIncome');
      if (fullYearTaxable <= 0) return '0.0000';
      const ratio = sr.stateTaxableIncome / fullYearTaxable;
      return ratio > 1 ? '1.0000' : fmtRatio(ratio);
    },
  },

  // Line 55: Credit amount (sum of 50-53 × Line 54)
  {
    pdfFieldName: '540NR_form_2036',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const depCare = al(sr, 'caDependentCareCredit');
      const depParent = al(sr, 'dependentParentCredit');
      const seniorHoH = al(sr, 'seniorHoHCredit');
      const total = depCare + depParent + seniorHoH;
      if (total <= 0) return '';
      const fullYearTaxable = al(sr, 'fullYearTaxableIncome');
      const ratio = fullYearTaxable > 0 ? Math.min(1, sr.stateTaxableIncome / fullYearTaxable) : 0;
      return Math.round(total * ratio).toString();
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 3 — Special Credits, Other Taxes, Payments, Overpaid/Due
  // ═══════════════════════════════════════════════════════════════

  // Line 61: Renter's Credit (nonrefundable)
  {
    pdfFieldName: '540NR_form_3008',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const renters = al(sr, 'rentersCredit');
      return renters > 0 ? Math.round(renters).toString() : '';
    },
  },

  // Line 62: Total credits (line 50-55 + line 61)
  {
    pdfFieldName: '540NR_form_3009',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const proratedCredits = al(sr, 'proratedNonrefundableCredits');
      return proratedCredits > 0 ? Math.round(proratedCredits).toString() : '';
    },
  },

  // Line 63: Subtract line 62 from line 42 (tax after credits)
  {
    pdfFieldName: '540NR_form_3010',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 72: Behavioral Health Services Tax (MHST, prorated)
  {
    pdfFieldName: '540NR_form_3012',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const mhst = al(sr, 'proratedMHST');
      return mhst > 0 ? Math.round(mhst).toString() : '';
    },
  },

  // Line 74: Total tax (line 63 + line 71 + line 72 + line 73)
  {
    pdfFieldName: '540NR_form_3014',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 81: CA income tax withheld
  {
    pdfFieldName: '540NR_form_3015',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 82: Estimated tax payments
  {
    pdfFieldName: '540NR_form_3016',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 85: CalEITC
  {
    pdfFieldName: '540NR_form_3019',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const calEITC = al(sr, 'calEITC');
      return calEITC > 0 ? Math.round(calEITC).toString() : '';
    },
  },

  // Line 86: Young Child Tax Credit (YCTC)
  {
    pdfFieldName: '540NR_form_3020',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const yctc = al(sr, 'youngChildTaxCredit');
      return yctc > 0 ? Math.round(yctc).toString() : '';
    },
  },

  // Line 88: Total payments (lines 81-87)
  {
    pdfFieldName: '540NR_form_3022',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const total = sr.stateWithholding + sr.stateEstimatedPayments +
        al(sr, 'calEITC') + al(sr, 'youngChildTaxCredit');
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 92: Payments after ISR penalty (same as line 88 for simple returns)
  {
    pdfFieldName: '540NR_form_3025',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const total = sr.stateWithholding + sr.stateEstimatedPayments +
        al(sr, 'calEITC') + al(sr, 'youngChildTaxCredit');
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 101: Overpaid tax (if line 92 > line 74)
  {
    pdfFieldName: '540NR_form_3027',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 103: Overpaid tax available this year
  {
    pdfFieldName: '540NR_form_3029',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 4 — Tax Due, Contributions
  // ═══════════════════════════════════════════════════════════════

  // Line 104: Tax due (if line 74 > line 92)
  {
    pdfFieldName: '540NR_form_4003',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 5 — Amount You Owe / Refund
  // ═══════════════════════════════════════════════════════════════

  // Line 121: Amount you owe
  {
    pdfFieldName: '540NR_form_5001',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 125: Refund or no amount due
  {
    pdfFieldName: '540NR_form_5007',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const CA_540NR_TEMPLATE: StateFormTemplate = {
  formId: 'ca-540nr',
  stateCode: 'CA',
  displayName: 'Form 540NR California Nonresident or Part-Year Resident Income Tax Return',
  pdfFileName: 'ca-540nr.pdf',
  condition: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) =>
    sr.stateCode === 'CA' && (sr.residencyType === 'nonresident' || sr.residencyType === 'part_year'),
  fields: CA_540NR_FIELDS,
};
