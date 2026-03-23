/**
 * LA IT-540 Louisiana Resident Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 IT-540 fillable PDF.
 *
 * LA uses federal AGI as starting point. Flat 3.0% rate (Act 11 reform).
 * Standard deduction varies by filing status. Exemptions repealed.
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const LA_IT540_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: 'PRMFN',
    sourcePath: 'firstName',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'PRMMN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'PRMLN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'PRMSFX',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.suffix || '').toUpperCase(),
  },
  {
    pdfFieldName: 'PRMSSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Spouse
  {
    pdfFieldName: 'SPOFN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'SPOMN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseMiddleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: 'SPOLN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseLastName || tr.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'SPOSFX',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSuffix || '').toUpperCase(),
  },
  {
    pdfFieldName: 'SPOSSN',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // Address
  {
    pdfFieldName: 'STADDR',
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
    pdfFieldName: 'ZIPCD',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.addressZip || '',
  },
  {
    pdfFieldName: 'PHNNUM',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '',
  },

  // ═══════════════════════════════════════════════════════════════
  // INCOME & TAX
  // ═══════════════════════════════════════════════════════════════

  // Federal Wages (from W-2)
  {
    pdfFieldName: 'FEDWAG',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.w2Income || []).reduce((sum, w) => sum + (w.wages || 0), 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Federal AGI
  {
    pdfFieldName: 'FEDAGI',
    sourcePath: 'federalAGI',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Federal Itemized Deductions (or 0 if standard)
  {
    pdfFieldName: 'FEDITM',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      if (tr.deductionMethod === 'itemized') {
        return Math.round(calc.form1040?.itemizedDeduction || 0).toString();
      }
      return '';
    },
  },

  // Standard Deduction
  {
    pdfFieldName: 'STDDED',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Federal Tax
  {
    pdfFieldName: 'FEDTAX',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const tax = calc.form1040?.totalTax || 0;
      return tax > 0 ? Math.round(tax).toString() : '';
    },
  },

  // LA Taxable Income
  {
    pdfFieldName: 'LATXBL',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // LA Tax (3.0%)
  {
    pdfFieldName: 'LATAX',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS & REFUND
  // ═══════════════════════════════════════════════════════════════

  // LA Income Tax Withheld
  {
    pdfFieldName: 'TAXWTH',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Estimated Payments
  {
    pdfFieldName: 'ESTPAY',
    sourcePath: 'stateEstimatedPayments',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Total Credits and Payments
  {
    pdfFieldName: 'TTLCR&PAY',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      // stateCredits are non-refundable (already factored into tax computation).
      const total = sr.stateWithholding + sr.stateEstimatedPayments;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Overpayment
  {
    pdfFieldName: 'OPYMNT',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Refund
  {
    pdfFieldName: 'REFUND',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Tax Due
  {
    pdfFieldName: 'TAXDUE',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Total Due
  {
    pdfFieldName: 'TTLDUE',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // DEPENDENTS
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: 'FN(6C).0',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.dependents?.[0]?.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'LN(6C).0',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.dependents?.[0]?.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'SSN(6C).0',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.dependents?.[0]?.ssn || '').replace(/-/g, ''),
  },
  {
    pdfFieldName: 'Relationship(6C).0',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.dependents?.[0]?.relationship || '',
  },
  {
    pdfFieldName: 'FN(6C).1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.dependents?.[1]?.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'LN(6C).1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.dependents?.[1]?.lastName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'SSN(6C).1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.dependents?.[1]?.ssn || '').replace(/-/g, ''),
  },
  {
    pdfFieldName: 'Relationship(6C).1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.dependents?.[1]?.relationship || '',
  },
];

// ─── Template ────────────────────────────────────────────────────

export const LA_IT540_TEMPLATE: StateFormTemplate = {
  formId: 'la-it540',
  stateCode: 'LA',
  displayName: 'IT-540 Louisiana Resident Income Tax Return',
  pdfFileName: 'la-it540.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'LA',
  fields: LA_IT540_FIELDS,
};
