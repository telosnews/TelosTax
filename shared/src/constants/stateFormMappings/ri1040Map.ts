/**
 * RI-1040 Rhode Island Resident Individual Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 RI-1040 fillable PDF.
 *
 * RI is a progressive-tax state: 3 brackets (3.75%, 4.75%, 5.99%).
 * Starts from federal AGI (no net modifications for most filers).
 * Standard deduction applies. $5,100 personal/dependent exemption.
 *
 * PDF: client/public/state-forms/ri-1040.pdf (51 fields)
 */
import type { TaxReturn, CalculationResult, StateCalculationResult } from '../../types/index.js';
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const RI_1040_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  // SSN (primary filer)
  {
    pdfFieldName: 'Your SSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Spouse SSN
  {
    pdfFieldName: 'Spouse SSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // Taxpayer name
  {
    pdfFieldName: 'Your First Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Your MI',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Your Last Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Your Suffix',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '', // Suffix not modeled in TaxReturn
  },

  // Spouse name
  {
    pdfFieldName: 'Spouse First Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Spouse MI',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseMiddleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Spouse Last Name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Spouse Suffix',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '', // Suffix not modeled
  },

  // Address
  {
    pdfFieldName: 'Address',
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
    sourcePath: 'addressZip',
    source: 'taxReturn',
    format: 'string',
  },
  {
    pdfFieldName: 'City of Legal Residence',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressCity || '').toUpperCase(),
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 1 — INCOME & TAX (Lines 1–13a)
  // ═══════════════════════════════════════════════════════════════

  // Line 1: Federal Adjusted Gross Income
  {
    pdfFieldName: 'Line 1',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 2: Net modifications (not modeled — empty)
  {
    pdfFieldName: 'Line 2',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 3: Modified federal AGI (= stateAGI)
  {
    pdfFieldName: 'Line 3',
    sourcePath: 'stateAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 4: RI standard deduction
  {
    pdfFieldName: 'Line 4',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 5: AGI minus deduction (stateAGI - stateDeduction, floor 0)
  {
    pdfFieldName: 'Line 5',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      const val = Math.max(0, sr.stateAGI - sr.stateDeduction);
      return val > 0 ? Math.round(val).toString() : '';
    },
  },

  // Line 6: Exemptions (number of exemptions x $5,100)
  {
    pdfFieldName: 'Line 6',
    sourcePath: 'stateExemptions',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 7: RI taxable income
  {
    pdfFieldName: 'Line 7',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 8: RI income tax (from tax rate schedule)
  {
    pdfFieldName: 'Line 8',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 9a: Allowable federal credit (not modeled — empty)
  {
    pdfFieldName: 'Line 9a',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 9b: Credit for income tax paid to other state (not modeled — empty)
  {
    pdfFieldName: 'Line 9b',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 9c: Other credits (not modeled — empty)
  {
    pdfFieldName: 'Line 9c',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 9d: Total credits
  {
    pdfFieldName: 'Line 9d',
    sourcePath: 'stateCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 10a: RI income tax after credits
  {
    pdfFieldName: 'Line 10a',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 10b: Recapture (not modeled — empty)
  {
    pdfFieldName: 'Line 10b',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 11: Checkoff contributions (not modeled — empty)
  {
    pdfFieldName: 'Line 11',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 12a: Use/sales tax (not modeled — empty)
  {
    pdfFieldName: 'Line 12a',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 12b: Individual mandate penalty (not modeled — empty)
  {
    pdfFieldName: 'Line 12b',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 13a: Total RI tax
  {
    pdfFieldName: 'Line 13a',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 2 HEADER
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: 'Page 2 Name',
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
  {
    pdfFieldName: 'Page 2 SSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 2 — PAYMENTS & REFUND (Lines 13b–18)
  // ═══════════════════════════════════════════════════════════════

  // Line 13b: Total RI tax (carried from 13a)
  {
    pdfFieldName: 'Line 13b',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 14a: RI income tax withheld
  {
    pdfFieldName: 'Line 14a',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 14b: Estimated tax payments
  {
    pdfFieldName: 'Line 14b',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 14c: Property tax credit (not modeled — empty)
  {
    pdfFieldName: 'Line 14c',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 14d: RI earned income credit (not modeled — empty)
  {
    pdfFieldName: 'Line 14d',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 14e: Lead paint credit (not modeled — empty)
  {
    pdfFieldName: 'Line 14e',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 14f: Other payments (not modeled — empty)
  {
    pdfFieldName: 'Line 14f',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 14g: Total payments (withholding + estimated payments)
  {
    pdfFieldName: 'Line 14g',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      const total = sr.stateWithholding + sr.stateEstimatedPayments;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 14h: Previously issued refund (not modeled — empty)
  {
    pdfFieldName: 'Line 14h',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 14i: Net payments (same as 14g — no amendments)
  {
    pdfFieldName: 'Line 14i',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      const total = sr.stateWithholding + sr.stateEstimatedPayments;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 15a: Amount due (if tax exceeds payments)
  {
    pdfFieldName: 'Line 15a',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 15b: Underpayment interest (not modeled — empty)
  {
    pdfFieldName: 'Line 15b',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 15c: Total amount due (same as 15a — no interest modeled)
  {
    pdfFieldName: 'Line 15c',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 16: Amount overpaid
  {
    pdfFieldName: 'Line 16',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 17: Refund amount (same as overpaid — full refund assumed)
  {
    pdfFieldName: 'Line 17',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, _calc: CalculationResult, sr: StateCalculationResult) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 18: Applied to next year estimated tax (not modeled — empty)
  {
    pdfFieldName: 'Line 18',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },
];

// ─── Template ────────────────────────────────────────────────────

export const RI_1040_TEMPLATE: StateFormTemplate = {
  formId: 'ri-1040',
  stateCode: 'RI',
  displayName: 'RI-1040 Rhode Island Resident Individual Income Tax Return',
  pdfFileName: 'ri-1040.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'RI',
  fields: RI_1040_FIELDS,
};
