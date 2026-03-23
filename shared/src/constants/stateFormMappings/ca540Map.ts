/**
 * CA-540 California Resident Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 CA Form 540 fillable PDF.
 *
 * CA-540 AcroForm fields use numeric IDs like "540_form_XYYY" where X = page, YYY = field id.
 * The mapping below was derived by visually correlating the PDF form with the field listing.
 */
import type { TaxReturn, CalculationResult, StateCalculationResult } from '../../types/index.js';
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';
import { FilingStatus } from '../../types/index.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const CA_540_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // PAGE 1 — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  // Your first name
  {
    pdfFieldName: '540_form_1003',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  // Your initial
  {
    pdfFieldName: '540_form_1005',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  // Your last name
  {
    pdfFieldName: '540_form_1004',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  // Your SSN or ITIN
  {
    pdfFieldName: '540_form_1007',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },
  // Spouse's first name
  {
    pdfFieldName: '540_form_1008',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  // Spouse's last name
  {
    pdfFieldName: '540_form_1009',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || '').toUpperCase(),
  },
  // Spouse's SSN
  {
    pdfFieldName: '540_form_1020',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // Street address
  {
    pdfFieldName: '540_form_1010',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  // City
  {
    pdfFieldName: '540_form_1011',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressCity || '').toUpperCase(),
  },
  // State
  {
    pdfFieldName: '540_form_1012',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressState || '').toUpperCase(),
  },
  // ZIP code
  {
    pdfFieldName: '540_form_1013',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.addressZip || '',
  },

  // Filing Status radio group (1=Single, 2=MFJ, 3=MFS, 4=HoH, 5=QSS)
  {
    pdfFieldName: '540_form_1036 RB',
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
    pdfFieldName: '540_form_1024',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const isMFJ = tr.filingStatus === FilingStatus.MarriedFilingJointly ||
        tr.filingStatus === FilingStatus.QualifyingSurvivingSpouse;
      return isMFJ ? '2' : '1';
    },
  },
  // Line 7 dollar amount (count x $153)
  {
    pdfFieldName: '540_form_1025',
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
    pdfFieldName: '540_form_1028',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const count = (tr.dependents || []).length;
      return count > 0 ? count.toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 2 — Taxable Income & Tax
  // ═══════════════════════════════════════════════════════════════

  // Page 2 header: Your name
  {
    pdfFieldName: '540_form_2001',
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
    pdfFieldName: '540_form_2002',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Line 11: Exemption amount (total)
  {
    pdfFieldName: '540_form_2003',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const credits = sr.additionalLines?.personalExemptionCredits || 0;
      return credits > 0 ? Math.round(credits).toString() : '';
    },
  },

  // Line 12: State wages from W-2 box 16
  {
    pdfFieldName: '540_form_2004',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const wages = (tr.w2Income || []).reduce((sum, w) => sum + (w.stateWages || w.wages || 0), 0);
      return wages > 0 ? Math.round(wages).toString() : '';
    },
  },

  // Line 13: Federal AGI
  {
    pdfFieldName: '540_form_2005',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 14: CA adjustments - subtractions
  {
    pdfFieldName: '540_form_2007',
    sourcePath: 'stateSubtractions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 15: Line 13 - Line 14
  {
    pdfFieldName: '540_form_2008',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const val = sr.federalAGI - sr.stateSubtractions;
      return Math.round(Math.max(0, val)).toString();
    },
  },

  // Line 16: CA adjustments - additions
  {
    pdfFieldName: '540_form_2009',
    sourcePath: 'stateAdditions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 17: CA adjusted gross income
  {
    pdfFieldName: '540_form_2010',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 18: Standard deduction or itemized deductions
  {
    pdfFieldName: '540_form_2011',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 19: Taxable income (Line 17 - Line 18)
  {
    pdfFieldName: '540_form_2012',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 31: Tax from brackets
  {
    pdfFieldName: '540_form_2013',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const baseTax = sr.additionalLines?.baseTaxBeforeMHST || 0;
      return baseTax > 0 ? Math.round(baseTax).toString() : '';
    },
  },

  // Line 32: Exemption credits
  {
    pdfFieldName: '540_form_2015',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const credits = sr.additionalLines?.personalExemptionCredits || 0;
      return credits > 0 ? Math.round(credits).toString() : '';
    },
  },

  // Line 33: Tax minus exemption credits
  {
    pdfFieldName: '540_form_2016',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const baseTax = sr.additionalLines?.baseTaxBeforeMHST || 0;
      const exemptionCredits = sr.additionalLines?.personalExemptionCredits || 0;
      return Math.round(Math.max(0, baseTax - exemptionCredits)).toString();
    },
  },

  // Line 35: Total (Line 33 + Line 34)
  {
    pdfFieldName: '540_form_2018',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const baseTax = sr.additionalLines?.baseTaxBeforeMHST || 0;
      const exemptionCredits = sr.additionalLines?.personalExemptionCredits || 0;
      return Math.round(Math.max(0, baseTax - exemptionCredits)).toString();
    },
  },

  // Line 46: Other credits (renter's + dependent care + senior HoH + dependent parent)
  {
    pdfFieldName: '540_form_2028',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const renters = sr.additionalLines?.rentersCredit || 0;
      const depCare = sr.additionalLines?.caDependentCareCredit || 0;
      const seniorHoH = sr.additionalLines?.seniorHoHCredit || 0;
      const depParent = sr.additionalLines?.dependentParentCredit || 0;
      const total = renters + depCare + seniorHoH + depParent;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 3 — Other Taxes, Payments, Overpaid Tax/Tax Due
  // ═══════════════════════════════════════════════════════════════

  // Page 3 header: Your name
  {
    pdfFieldName: '540_form_3003',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.firstName, tr.lastName].filter(Boolean);
      return parts.join(' ').toUpperCase();
    },
  },
  // Page 3 header: SSN
  {
    pdfFieldName: '540_form_3004',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Line 47: Total nonrefundable credits (exemption + other credits from Lines 32-46)
  {
    pdfFieldName: '540_form_3005',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const exemption = sr.additionalLines?.personalExemptionCredits || 0;
      const renters = sr.additionalLines?.rentersCredit || 0;
      const depCare = sr.additionalLines?.caDependentCareCredit || 0;
      const seniorHoH = sr.additionalLines?.seniorHoHCredit || 0;
      const depParent = sr.additionalLines?.dependentParentCredit || 0;
      const total = exemption + renters + depCare + seniorHoH + depParent;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 48: Line 35 - Line 47 (tax after credits)
  {
    pdfFieldName: '540_form_3006',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 62: Mental Health Services Tax
  {
    pdfFieldName: '540_form_3008',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const mhst = sr.additionalLines?.mentalHealthServicesTax || 0;
      return mhst > 0 ? Math.round(mhst).toString() : '';
    },
  },

  // Line 64: Total tax
  {
    pdfFieldName: '540_form_3010',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 71: CA income tax withheld
  {
    pdfFieldName: '540_form_3011',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 72: Estimated tax payments
  {
    pdfFieldName: '540_form_3012',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 74: Young Child Tax Credit (YCTC)
  {
    pdfFieldName: '540_form_3014',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const yctc = sr.additionalLines?.youngChildTaxCredit || 0;
      return yctc > 0 ? Math.round(yctc).toString() : '';
    },
  },

  // Line 75: CalEITC
  {
    pdfFieldName: '540_form_3015',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const calEITC = sr.additionalLines?.calEITC || 0;
      return calEITC > 0 ? Math.round(calEITC).toString() : '';
    },
  },

  // Line 78: Total payments
  {
    pdfFieldName: '540_form_3018',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const total = sr.stateWithholding + sr.stateEstimatedPayments +
        (sr.additionalLines?.calEITC || 0) + (sr.additionalLines?.youngChildTaxCredit || 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 93: Payments balance
  {
    pdfFieldName: '540_form_3022',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const totalPayments = sr.stateWithholding + sr.stateEstimatedPayments +
        (sr.additionalLines?.calEITC || 0) + (sr.additionalLines?.youngChildTaxCredit || 0);
      const balance = totalPayments - sr.totalStateTax;
      return balance > 0 ? Math.round(balance).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 4 — Overpaid Tax / Tax Due
  // ═══════════════════════════════════════════════════════════════

  // Page 4 header: Your name
  {
    pdfFieldName: '540_form_4003',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.firstName, tr.lastName].filter(Boolean);
      return parts.join(' ').toUpperCase();
    },
  },
  // Page 4 header: SSN
  {
    pdfFieldName: '540_form_4004',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Line 97: Overpaid tax
  {
    pdfFieldName: '540_form_4005',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 99: Overpaid tax available this year (same as line 97 for simple returns)
  {
    pdfFieldName: '540_form_4007',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 100: Tax due
  {
    pdfFieldName: '540_form_4008',
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

  // Page 5 header: Your name
  {
    pdfFieldName: '540_form_5002',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.firstName, tr.lastName].filter(Boolean);
      return parts.join(' ').toUpperCase();
    },
  },

  // Line 111: Amount you owe
  {
    pdfFieldName: '540_form_5003',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 115: Refund
  {
    pdfFieldName: '540_form_5007',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const CA_540_TEMPLATE: StateFormTemplate = {
  formId: 'ca-540',
  stateCode: 'CA',
  displayName: 'Form 540 California Resident Income Tax Return',
  pdfFileName: 'ca-540.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'CA' && sr.residencyType === 'resident',
  fields: CA_540_FIELDS,
};
