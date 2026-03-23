/**
 * AZ Form 140 — Arizona Resident Personal Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 Form 140 fillable PDF.
 *
 * AZ is a flat-tax state at 2.5%. Conforms to federal standard deduction.
 * Aged exemption of $2,100 for 65+. Dependent credits: $100 under-17, $25 17+.
 *
 * PDF: client/public/state-forms/az-140.pdf (406 fields)
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const AZ_140_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  // Taxpayer name
  {
    pdfFieldName: '1a',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: '1b',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: '1c',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },

  // SSN
  {
    pdfFieldName: '1d',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Spouse name
  {
    pdfFieldName: '1e',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.spouseFirstName, tr.spouseMiddleInitial, tr.spouseLastName].filter(Boolean);
      return parts.join(' ').toUpperCase();
    },
  },

  // Spouse SSN
  {
    pdfFieldName: '1f',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // Address
  {
    pdfFieldName: '2a',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  {
    pdfFieldName: '2b',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '', // Apt/suite not modeled
  },
  {
    pdfFieldName: '2c',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '', // Foreign country not applicable
  },
  {
    pdfFieldName: 'City, Town, Post Office',
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

  // ═══════════════════════════════════════════════════════════════
  // FILING STATUS
  // ═══════════════════════════════════════════════════════════════

  // AZ uses a RadioGroup for filing status (values: 1=Single, 2=MFJ, 3=MFS, 4=HoH, 5=QSS)
  // We map to checkbox format and let the filler handle radio group values
  {
    pdfFieldName: '4a',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 1, // Single
  },

  // ═══════════════════════════════════════════════════════════════
  // EXEMPTIONS (Lines 8–9)
  // ═══════════════════════════════════════════════════════════════

  // Line 8: Age 65 or older (self)
  {
    pdfFieldName: '8',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      if (!tr.dateOfBirth) return '';
      const year = parseInt(tr.dateOfBirth.substring(0, 4), 10);
      return (!isNaN(year) && (2025 - year) >= 65) ? '2100' : '';
    },
  },

  // Line 9: Age 65 or older (spouse)
  {
    pdfFieldName: '9',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      if (!tr.spouseDateOfBirth) return '';
      const year = parseInt(tr.spouseDateOfBirth.substring(0, 4), 10);
      return (!isNaN(year) && (2025 - year) >= 65) ? '2100' : '';
    },
  },

  // Line 10a: Number of dependents under 17
  {
    pdfFieldName: '10a',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const under17 = (tr.dependents || []).filter(d => {
        if (!d.dateOfBirth) return false;
        const year = parseInt(d.dateOfBirth.substring(0, 4), 10);
        return !isNaN(year) && (2025 - year) < 17;
      }).length;
      return under17 > 0 ? under17.toString() : '';
    },
  },

  // Line 10b: Number of dependents 17+
  {
    pdfFieldName: '10b',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const age17plus = (tr.dependents || []).filter(d => {
        if (!d.dateOfBirth) return true; // Assume 17+ if no DOB
        const year = parseInt(d.dateOfBirth.substring(0, 4), 10);
        return !isNaN(year) && (2025 - year) >= 17;
      }).length;
      return age17plus > 0 ? age17plus.toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // INCOME (Lines 12–16)
  // ═══════════════════════════════════════════════════════════════

  // Line 12: Federal Adjusted Gross Income
  {
    pdfFieldName: '12',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 13: Additions (state additions)
  {
    pdfFieldName: '13',
    sourcePath: 'stateAdditions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 14: Subtotal (AGI + additions)
  {
    pdfFieldName: '14',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => Math.round(sr.federalAGI + sr.stateAdditions).toString(),
  },

  // Line 15: Subtractions
  {
    pdfFieldName: '15',
    sourcePath: 'stateSubtractions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 16: Arizona Adjusted Gross Income
  {
    pdfFieldName: '16',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // DEDUCTIONS & EXEMPTIONS (Lines 17–22)
  // ═══════════════════════════════════════════════════════════════

  // Line 17: Itemized or standard deduction
  {
    pdfFieldName: '17',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 18: Personal exemptions
  {
    pdfFieldName: '18',
    sourcePath: 'stateExemptions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 19: Total deductions (Line 17 + Line 18)
  {
    pdfFieldName: '19',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => Math.round(sr.stateDeduction + sr.stateExemptions).toString(),
  },

  // Line 20: AZ Taxable Income
  {
    pdfFieldName: '20',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // TAX COMPUTATION (Lines 21–27)
  // ═══════════════════════════════════════════════════════════════

  // Line 21: Tax amount (2.5% flat rate)
  {
    pdfFieldName: '21',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 22: Dependent credit
  {
    pdfFieldName: '22',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const credits = sr.stateCredits;
      return credits > 0 ? Math.round(credits).toString() : '';
    },
  },

  // Line 27: Tax after credits
  {
    pdfFieldName: '27',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS (Lines 33–42)
  // ═══════════════════════════════════════════════════════════════

  // Line 33: Tax after credits total
  {
    pdfFieldName: '33',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 35: AZ income tax withheld
  {
    pdfFieldName: '35',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 37: Estimated tax payments
  {
    pdfFieldName: '37',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 42: Total payments
  {
    pdfFieldName: '42',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const total = sr.stateWithholding + sr.stateEstimatedPayments;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // REFUND / AMOUNT OWED (Lines 43–56)
  // ═══════════════════════════════════════════════════════════════

  // Line 43: Tax due (if positive balance)
  {
    pdfFieldName: '43',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 55: Overpayment (refund)
  {
    pdfFieldName: '55',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 56: Refund amount
  {
    pdfFieldName: '56',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const AZ_140_TEMPLATE: StateFormTemplate = {
  formId: 'az-140',
  stateCode: 'AZ',
  displayName: 'Form 140 Arizona Resident Personal Income Tax Return',
  pdfFileName: 'az-140.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'AZ',
  fields: AZ_140_FIELDS,
};
