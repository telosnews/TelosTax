/**
 * AL Form 40 Alabama Individual Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the 2025 AL Form 40 fillable PDF.
 *
 * AL uses a custom calculator (engine/state/al.ts) with:
 *   - Progressive brackets (2% / 4% / 5%)
 *   - Federal tax deduction (unique to AL)
 *   - Standard deduction with income-based phase-down
 *   - Personal exemption + dependent exemption tiers
 *
 * PDF field names are uppercase identifiers (e.g., FIRSTNAME, WAGESINC).
 * Schedule fields (Sch* prefix) are excluded — this covers main Form 40 only.
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const AL_40_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  // Primary SSN
  {
    pdfFieldName: 'SSSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Taxpayer name
  {
    pdfFieldName: 'FIRSTNAME',
    sourcePath: 'firstName',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'MIDDLEINITIAL',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'LASTNAME',
    sourcePath: 'lastName',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },

  // Spouse name
  {
    pdfFieldName: 'SPOUSEFIRSTNAME',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'SPMIDDLEINITIAL',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseMiddleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'SPOUSELASTNAME',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || tr.lastName || '').toUpperCase(),
  },

  // Spouse SSN
  {
    pdfFieldName: 'SPSSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // Address (on Schedule OC page, the main address field)
  {
    pdfFieldName: 'ADDRESS',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  {
    pdfFieldName: 'CITY',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressCity || '').toUpperCase(),
  },
  {
    pdfFieldName: 'STATE',
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

  // ═══════════════════════════════════════════════════════════════
  // FILING STATUS (checkboxes)
  // ═══════════════════════════════════════════════════════════════

  // Single
  {
    pdfFieldName: 'S',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 1, // Single
  },
  // Married Filing Jointly
  {
    pdfFieldName: 'MFJ',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 2, // MFJ
  },
  // Married Filing Separately
  {
    pdfFieldName: 'MFS',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 3, // MFS
  },
  // Head of Family
  {
    pdfFieldName: 'HOF',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.filingStatus === 4, // HoH
  },

  // ═══════════════════════════════════════════════════════════════
  // INCOME (Page 1)
  // ═══════════════════════════════════════════════════════════════

  // Federal AGI (starting point for AL)
  {
    pdfFieldName: 'ADJGRSINC',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Wages/Salaries (W-2 income)
  {
    pdfFieldName: 'WAGESINC',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const w2Total = (tr.w2Income || []).reduce((sum, w) => sum + (w.wages || 0), 0);
      return w2Total > 0 ? Math.round(w2Total).toString() : '';
    },
  },

  // Interest and Dividends
  {
    pdfFieldName: 'INTDIVINC',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const interest = (tr.income1099INT || []).reduce((sum, i) => sum + (i.amount || 0), 0);
      const dividends = (tr.income1099DIV || []).reduce((sum, d) => sum + (d.ordinaryDividends || 0), 0);
      const total = interest + dividends;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Business income
  {
    pdfFieldName: 'BUSINC',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const bizIncome = calc.scheduleC?.netProfit || 0;
      return bizIncome !== 0 ? Math.round(Math.abs(bizIncome)).toString() : '';
    },
  },

  // Total other income
  {
    pdfFieldName: 'TOTOTHERINC',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Detailed other income not modeled
  },

  // Total income
  {
    pdfFieldName: 'TOTALINC',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Total adjustments to income
  {
    pdfFieldName: 'TOTADJINC',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const adj = sr.stateSubtractions;
      return adj > 0 ? Math.round(adj).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // DEDUCTIONS & EXEMPTIONS
  // ═══════════════════════════════════════════════════════════════

  // Standard deduction checkbox
  {
    pdfFieldName: 'CHKSTDDED',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.deductionMethod !== 'itemized',
  },
  // Itemized deduction checkbox
  {
    pdfFieldName: 'CHKITMDED',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (_, tr) => tr.deductionMethod === 'itemized',
  },

  // Itemized or standard deduction amount
  {
    pdfFieldName: 'ITMSTDDED',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Federal tax liability deduction (unique to AL)
  {
    pdfFieldName: 'FEDTXLIABDED',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const fedTaxDed = sr.additionalLines?.federalTaxDeduction || 0;
      return fedTaxDed > 0 ? Math.round(fedTaxDed).toString() : '';
    },
  },

  // Personal exemption
  {
    pdfFieldName: 'PERSEXEMP',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const pe = sr.additionalLines?.personalExemption || 0;
      return pe > 0 ? Math.round(pe).toString() : '';
    },
  },

  // Dependent exemption
  {
    pdfFieldName: 'DEPEXMPTION',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const de = sr.additionalLines?.dependentExemption || 0;
      return de > 0 ? Math.round(de).toString() : '';
    },
  },

  // Total deductions
  {
    pdfFieldName: 'TOTDED',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const total = sr.stateDeduction + sr.stateExemptions +
        (sr.additionalLines?.federalTaxDeduction || 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // TAXABLE INCOME & TAX
  // ═══════════════════════════════════════════════════════════════

  // Taxable income
  {
    pdfFieldName: 'TAXINC',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Net tax due (from tax table/brackets)
  {
    pdfFieldName: 'NETTAXDUE',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Total tax liability (after credits)
  {
    pdfFieldName: 'TOTTAXLIB',
    sourcePath: 'totalStateTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS
  // ═══════════════════════════════════════════════════════════════

  // AL tax withheld (from W-2s)
  {
    pdfFieldName: 'TOTALWH',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },
  // Also fill the page 1 withholding field
  {
    pdfFieldName: 'ALTXWH',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Estimated/Extension payments
  {
    pdfFieldName: 'ESTMEXTSIONPMT',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Total payments
  {
    pdfFieldName: 'TOTPMT',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const total = sr.stateWithholding + sr.stateEstimatedPayments;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // REFUND / AMOUNT OWED
  // ═══════════════════════════════════════════════════════════════

  // Amount owed (tax > payments)
  {
    pdfFieldName: 'AMTOWE',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Overpayment
  {
    pdfFieldName: 'OVERPAID',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Refund to you
  {
    pdfFieldName: 'REFTOYOU',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const AL_40_TEMPLATE: StateFormTemplate = {
  formId: 'al-40',
  stateCode: 'AL',
  displayName: 'Form 40 Alabama Individual Income Tax Return',
  pdfFileName: 'al-40.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'AL',
  fields: AL_40_FIELDS,
};
